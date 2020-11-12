'use strict';
const chromium = require('chrome-aws-lambda');
const puppeteer = chromium.puppeteer;
const fs = require('fs')
const path = require('path')
const utils = require('util')
const hb = require('handlebars')
const readFile = utils.promisify(fs.readFile)
var AWS = require("aws-sdk");


async function getTemplateHtml() {

    console.log("Loading template file in memory")
    try {
        const invoicePath = path.resolve("./invoice.html");
        return await readFile(invoicePath, 'utf8');
    } catch (err) {
        return Promise.reject("Could not load html template");
    }
}


module.exports.index = async () => {

    let data = {};
   
    await getTemplateHtml()
        .then(async (res) => {
            // Now we have the html code of our template in res object
            // you can check by logging it on console
            // console.log(res)
            let browser = null;
            console.log("Comping the template with handlebars")
            const template = hb.compile(res, { strict: true });
            // we have compile our code with handlebars
            const result = template(data);
            // We can use this to add dyamic data to our handlebas template at run time from database or API as per need. you can read the official doc to learn more https://handlebarsjs.com/
            const html = result;
            console.log("Html created", html)
            // we are using headless mode 
            // browser = await puppeteer.launch();
            browser = await puppeteer.launch({
                headless: true,
                executablePath: await chromium.executablePath,
                args: chromium.args,
                dumpio: true,
              });
            const page = await browser.newPage()

            // We set the page content as the generated html by handlebars
            
            await page.setContent(html)

            // we Use pdf function to generate the pdf in the same folder as this file.
            // await page.pdf({ path: './invoice.pdf', format: 'A4' })
            const pdf = await page.pdf({ format: 'A4' });

            await browser.close();
            console.log("PDF Generated")
            console.log(pdf)
            
              let S3_BUCKET_NAME = 'dev-cdn.sustainably.go';
              let S3_BUCKET_SECRET = '+vpp0yPTpVyAcMwdEyJsWhwBt9S8zjvm9v3GEiJXZ';
              let S3_BUCKET_KEY = 'AKIAYLWKX2YUNN2GRMUXW';
              // s3 configuration ends here
              const s3Storage = new AWS.S3({
                accessKeyId: S3_BUCKET_KEY,
                secretAccessKey: S3_BUCKET_SECRET
              });
              
              
            const destparams = {
                  Bucket: S3_BUCKET_NAME,
                  Key: 'pdf/invoice.pdf',
                  Body: pdf,
                  ContentType: "application/pdf"
                };
              
            const putResult = await s3Storage.putObject(destparams).promise();
            console.log("s3 compleat", putResult)    
                return {
                    headers: {
                        'Content-type': 'application/pdf',
                        'content-disposition': 'attachment; filename=invoice.pdf'
                      },
                      statusCode: 200,
                      body: pdf.toString('base64'),
                      isBase64Encoded: true
                  };
        })
        .catch(err => {
            console.error(err);
            return {
              statusCode: 500
            };
        });
    console.log("Last")
}
