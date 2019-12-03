#!/usr/bin/env node

const inquirer = require('inquirer');
const jsonfile = require('jsonfile');
const {promises: fs} = require('fs');
const nodemailer = require('nodemailer');
const getYear = require('date-fns/getYear');

inquirer.registerPrompt('fuzzypath', require('inquirer-fuzzy-path'));

const defaultSettings = {port:587};

function shuffle(santas){
    let currentindex = santas.length;
    let swapindex, s;
    //shuffle
    while(currentindex>0){
        swapindex = Math.floor(Math.random()*currentindex);
        currentindex-=1;
        if(swapindex!=currentindex){
            s=santas[currentindex];
            santas[currentindex]=santas[swapindex];
            santas[swapindex]=s;
        }
    }
    //assign
    for(let i=0;i<santas.length-1;i++){
        santas[i].santee={...santas[i+1], santee:null}; //create a copy withoyt a santee to prevent circular object
    }
    santas[santas.length-1].santee={...santas[0], santee:null}; //create a copy withoyt a santee to prevent circular object
    return santas;
}

async function send(mail, santas){

    let emails = santas.map(santa=>({
        to:`"${santa.name}" ${santa.email}`,
        text:`Your santee is: ${santa.santee.name}!\nKeep it secret! Keep it safe!\n\nSanta`,
        html:`<p>Your santee is... <b>${santa.santee.name}!</b></p>
        <p>Keep it secret! Keep it safe!<p>
        <p>Santa</p>`
    }));
    //console.log(emails);

    //let testAccount = await nodemailer.createTestAccount();

    let transoptions = {
        name: mail.host,
        //pool: true,
        host: mail.host, 
        port: mail.port,
        secure: false, 
        tls: {
            rejectUnauthorized:false
        },
        auth: {
            user: mail.user,
            pass: mail.pass
        }
    };

    let transdefaults = {
        from:'"Santa" '+ mail.email,
        subject:`SECRET SANTA ${getYear(new Date())}`,
    }
    let trans = nodemailer.createTransport(transoptions, transdefaults);

    try{
        await trans.verify();
        while (emails.length) {
            console.log(emails.length);
            trans.sendMail(emails.shift());
        }
    }catch(eee){
        console.error(eee);
        console.log(transoptions, mail);
    }finally{
        //trans.close();
    }
}

async function main(){

    let setting = Object.assign({}, defaultSettings, await fs.access('settings.json').then(f=>jsonfile.readFile('settings.json')).catch(e=>({})));
    
    const questions = [
        {type: 'fuzzypath', name:'santafile', message:'Santas file?',
            excludePath: nodePath => nodePath.startsWith('node_modules')||nodePath.startsWith('.'),
            validate: async (f)=>await fs.access(f).then(f=>true).catch(e=>'No access to that file'),
            default:'santas.json'
        },
        {type: 'input', name:'host', message:'Mail host?', default:setting.host},
        {type: 'input', name:'port', message:'Mail port?', default:setting.port},
        {type: 'input', name:'user', message:'Sending user?', default:setting.user},
        {type: 'input', name:'email', message:'Sending email, if different than user (leave blank if not)?', default:setting.email},
        {type: 'password', name:'pass', message:'Sending user password?', mask:'*'},
        {type:'confirm', name:'spoil', message:'Show results?', default:false}
    ];

    let answers = await inquirer.prompt(questions);
    answers.email=answers.email||answers.user;
    let santas = await jsonfile.readFile(answers.santafile);
    santas = shuffle(santas);
    if (answers.spoil) console.log(santas);
    await send(answers, santas);
}


main().catch(console.error);