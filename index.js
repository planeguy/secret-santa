#!/usr/bin/env node

const inquirer = require('inquirer');
const jsonfile = require('jsonfile');
const {promises: fs} = require('fs');
const nodemailer = require('nodemailer');
const getYear = require('date-fns/getYear');

inquirer.registerPrompt('fuzzypath', require('inquirer-fuzzy-path'));

const defaultSettings = {port:587};
const SPOIL_no = 'Do not spoil';
const SPOIL_save = 'Spoil to file';
const SPOIL_console = 'Spoil to console';

function shuffle(santas, iterations=8){
    let currentindex = santas.length;
    let swapindex, s;
    //shuffle
    for(let i=iterations;i>0;i--){
        while(currentindex>0){
            swapindex = Math.floor(Math.random()*currentindex);
            currentindex-=1;
            if(swapindex!=currentindex){
                s=santas[currentindex];
                santas[currentindex]=santas[swapindex];
                santas[swapindex]=s;
            }
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
    let extraplain='', extrahtml='';
    if(!!mail.extra) {
        extraplain=`${mail.extra}\n\n`;
        extrahtml=`<p>${mail.extra}<p>`;
    }
    let emails = santas.map(santa=>({
        to:`"${santa.name}" ${santa.email}`,
        text:`Happy winter celebration!\n\n
        Your santee is: ${santa.santee.name}!\n
        Keep it secret! Keep it safe!\n\n
        ${extraplain}
        Santa`,
        html:`<p>Happy winter celebration!</p>
        <p>Your santee is... <b>${santa.santee.name}!</b></p>
        <p>Keep it secret! Keep it safe!<p>${extrahtml}
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
        subject:`GARDENCONDO SECRET SANTA ${getYear(new Date())}`,
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

async function getEmailSettings(setting){
    const emailQs = [
        {type: 'input', name:'host', message:'Mail host?', default:setting.host},
        {type: 'input', name:'port', message:'Mail port?', default:setting.port},
        {type: 'input', name:'user', message:'Sending user?', default:setting.user},
        {type: 'input', name:'email', message:'Sending email, if different than user (leave blank if not)?', default:setting.email},
        {type: 'password', name:'pass', message:'Sending user password?', mask:'*'},
        {type: 'input', name:'extra', message:'Extra text (leave blank if none)?'}
    ];
    let emailAnswers = await inquirer.prompt(emailQs);
    emailAnswers.email = emailAnswers.email||emailAnswers.user;
    return emailAnswers;
}

async function getSpoilSettings(){
    const spoilQs = [
        {type: 'list', name:'spoil', message:'Spoil the results?', choices:[
            SPOIL_no,
            SPOIL_save,
            SPOIL_console
        ], default: SPOIL_no, loop:true}
    ];
    return await inquirer.prompt(spoilQs);
}

async function main(){

    let setting = Object.assign({}, defaultSettings, await fs.access('settings.json').then(f=>jsonfile.readFile('settings.json')).catch(e=>({})));
    
    const questions = [
        {type: 'fuzzypath', name:'santafile', message:'Santas file?',
            excludePath: nodePath => nodePath.includes('node_modules'),
            excludeFilter: p=>p.startsWith('.')||!p.endsWith('.json'),
            validate: async (f)=>await fs.access(f.value).then(f=>true).catch(e=>`No access to file ${JSON.stringify(f)} ${JSON.stringify(e)}`),
            itemType:'file'
        },
        {type:'confirm', name:'debug',message:'Dry run?', default:false}
    ];

    let answers = await inquirer.prompt(questions);
    let santas = await jsonfile.readFile(answers.santafile);
    santas = shuffle(santas);

    let s = await getSpoilSettings();
    switch(s.spoil){
        case SPOIL_save:
            jsonfile.writeFile(answers.santafile+'-results.json', santas);
            break;
        case SPOIL_console:
            console.log(santas)
            break;
    }

    if (!answers.debug){
        await send(await getEmailSettings(setting), santas);
        console.log('Sent!')
    }
}


main().catch(console.error);