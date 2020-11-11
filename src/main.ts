import * as core from '@actions/core';
import * as fs from "fs";
import { uploadToPlayStore } from "./edits";
const {google} = require('googleapis');

const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
});

async function run() {
    try {
        const serviceAccountJson = core.getInput('serviceAccountJson', { required: false });
        const serviceAccountJsonRaw = core.getInput('serviceAccountJsonPlainText', { required: false});
        const packageName = core.getInput('packageName', { required: true });
        const releaseFiles = core.getInput('releaseFiles', { required: true }).split(',').filter(x => x !== '');
        const releaseName = core.getInput('releaseName', { required: false });
        const track = core.getInput('track', { required: true });
        const inAppUpdatePriority = core.getInput('inAppUpdatePriority', { required: false });
        const userFraction = core.getInput('userFraction', { required: false });
        const whatsNewDir = core.getInput('whatsNewDirectory', { required: false });
        const mappingFile = core.getInput('mappingFile', { required: false });

        // Validate that we have a service account json in some format
        if (!serviceAccountJson && !serviceAccountJsonRaw) {
            console.log("No service account json key provided!");
            core.setFailed("You must provide one of 'serviceAccountJson' or 'serviceAccountJsonPlainText' to use this action");
        }

        // If the user has provided the raw plain text via secrets, or w/e, then write to file and
        // set appropriate env variable for the auth
        if (serviceAccountJsonRaw) {
            const serviceAccountFile = "./serviceAccountJson.json";
            fs.writeFileSync(serviceAccountFile, serviceAccountJsonRaw, {
                encoding: 'utf8'
            });

            // Insure that the api can find our service account credentials
            core.exportVariable("GOOGLE_APPLICATION_CREDENTIALS", serviceAccountFile);
        }

        if (serviceAccountJson) {
            // Insure that the api can find our service account credentials
            core.exportVariable("GOOGLE_APPLICATION_CREDENTIALS", serviceAccountJson);
        }

        // Validate user fraction as a number, and within [0.0, 1.0]
        let userFractionFloat: number | undefined = parseFloat(userFraction);
        if (!isNaN(userFractionFloat)) {
            if (userFractionFloat <= 0.0 || userFractionFloat >= 1.0) {
                core.setFailed('A provided userFraction must be between 0.0 and 1.0, inclusive-inclusive');
                return;
            }
        } else {
            userFractionFloat = undefined;
        }

        // Validate the inAppUpdatePriority to be a valid number in within [0, 5]
        let inAppUpdatePriorityInt: number | undefined = parseInt(inAppUpdatePriority);
        if (!isNaN(inAppUpdatePriorityInt)) {
            if (inAppUpdatePriorityInt < 0 || inAppUpdatePriorityInt > 5) {
                core.setFailed('inAppUpdatePriority must be between 0 and 5, inclusive-inclusive');
                return;
            }
        } else {
            inAppUpdatePriorityInt = undefined;
        }

        // Check release files
        for (const releaseFile of releaseFiles) {
            core.debug(`Validating ${releaseFile} exists`)
            if (!fs.existsSync(releaseFile)) {
                core.setFailed(`Unable to find release file @ ${releaseFile}`);
                return
            }
        }

        if (whatsNewDir != undefined && whatsNewDir.length > 0 && !fs.existsSync(whatsNewDir)) {
            core.setFailed(`Unable to find 'whatsnew' directory @ ${whatsNewDir}`);
            return
        }

        if (mappingFile != undefined && mappingFile.length > 0 && !fs.existsSync(mappingFile)) {
            core.setFailed(`Unable to find 'mappingFile' @ ${mappingFile}`);
            return
        }

        const authClient = await auth.getClient();

        await uploadToPlayStore({
            auth: authClient,
            applicationId: packageName,
            track: track,
            inAppUpdatePriority: inAppUpdatePriorityInt || 0,
            userFraction: userFractionFloat,
            whatsNewDir: whatsNewDir,
            mappingFile: mappingFile,
            name: releaseName
        }, releaseFiles);

        console.log(`Finished uploading to the Play Store`)
    } catch (error) {
        core.setFailed(error.message)
    }
}

run();
