const restify = require('restify');
const { BotFrameworkAdapter, CardFactory} = require('botbuilder');

const {
    getUserByAadObjectId,
    callAuthAPI,
    callPunchStatusAPI,
    callPunchInAPI,
    callPunchOutResponse,
    callPunchOutAPI,
    fetchProjects
} = require('./nms');

const workModeSelectionCard = require('./cards/punchlocation');
const  projectSelectionCard= require('./cards/worklocation');
const taskInputCard = require('./cards/taskinput');
const PunchOutCard = require('./cards/punchout');

(async () => {
    const fetch = (await import('node-fetch')).default;

    globalThis.fetch = fetch;

    const adapter = new BotFrameworkAdapter({
        appId: process.env.MicrosoftAppId,
        appPassword: process.env.MicrosoftAppPassword
    });

    const server = restify.createServer();
    server.listen(process.env.port || process.env.PORT || 3978, function () {
        console.log(`\n${server.name} listening to ${server.url}`);
    });


    const userSelections = {};

    server.post('/api/messages', async (req, res) => {
        await adapter.processActivity(req, res, async (context) => {
            if (context.activity.type === 'message') {
                const userId = context.activity.from.id;
                const aadObjectId = context.activity.from.aadObjectId;
    
                if (aadObjectId) {
                    try {
                        const user = await getUserByAadObjectId(aadObjectId);
                        if (user) {
                            const authResponse = await callAuthAPI(userId, user.mail);
                            if (authResponse) {
                                const accessToken = authResponse.accessToken;
                                const decodedToken = authResponse.decodedToken;
                                const punchStatus = await callPunchStatusAPI(decodedToken.userId, accessToken);
                                if (context.activity.text === 'punch in') {
                                    console.log(punchStatus);
                                    userSelections[userId] = { initiated: true };

                                    if (punchStatus && punchStatus.data === "OUT") {
                                        const projectsResponse = await fetchProjects(accessToken);
    
                                        if (projectsResponse.ok) {
                                            const projectsData = await projectsResponse.json();
                                            if (projectsData.status === 200 && projectsData.data.length > 0) {
                                                const card = projectSelectionCard(projectsData.data);
                                                await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
                                            } else {
                                                await context.sendActivity('No projects available to punch in.');
                                            }
                                        } else {
                                            await context.sendActivity('Failed to fetch projects. Please try again later.');
                                        }
                                    } else {
                                        await context.sendActivity('You are already punched in.');
                                    }
                                } else if (context.activity.value && context.activity.value.action === 'selectProject') {
                                    if (userSelections[userId]?.initiated) {
                                        const selectedProjectCode = context.activity.value.projectCode;
                                        const workModeCard = workModeSelectionCard(selectedProjectCode);
                                        await context.sendActivity({ attachments: [CardFactory.adaptiveCard(workModeCard)] });
                                    } else {
                                        await context.sendActivity('Please start the process by typing "punch in" before selecting a project.');
                                    }
                                } else if (context.activity.value && context.activity.value.action === 'selectWorkMode') {
                                    if (userSelections[userId]?.initiated) {
                                        const selectedWorkMode = context.activity.value.workMode;
                                        const projectCode = context.activity.value.projectCode;
    
                                        // Show task input card
                                        const taskCard = taskInputCard(projectCode, selectedWorkMode);
                                        await context.sendActivity({ attachments: [CardFactory.adaptiveCard(taskCard)] });
                                    } else {
                                        await context.sendActivity('Please start the process by typing "punch in" before selecting a work mode.');
                                    }
                                } else if (context.activity.value && context.activity.value.action === 'submitTask') {
                                    if (userSelections[userId]?.initiated) {
                                        const task = context.activity.value.task;
                                        const projectCode = context.activity.value.projectCode;
                                        const selectedWorkMode = context.activity.value.selectedWorkMode;
    
                                        const punchInResponse = await callPunchInAPI(decodedToken.userId, accessToken, projectCode, selectedWorkMode, task);
                                        if (punchInResponse) {
                                            await context.sendActivity(`You have successfully Punched In`);
                                        } else {
                                            await context.sendActivity('Failed to punch in.');
                                        }
                                        userSelections[userId] = { initiated: false };
                                    } else {
                                        await context.sendActivity('Please start the process by typing "punch in" before submitting a task.');
                                    }
                                }else if (context.activity.text === 'punch out' && punchStatus && punchStatus.data === "IN") {
                                    try {
                                        const punchOutResponses = await callPunchOutResponse(accessToken,decodedToken.userId);
                                        
                                        if (punchOutResponses.ok) {
                                            const punchOutData = await punchOutResponses.json();
                                            console.log('Punch Out Data:', punchOutData);

                                            const outCard = PunchOutCard(punchOutData);
                                            await context.sendActivity({ attachments: [CardFactory.adaptiveCard(outCard)] });
                                        } else {
                                            await context.sendActivity('Failed to retrieve punch-out information. Please try again later.');
                                        }
                                    } catch (error) {
                                        console.error('Punch Out Error:', error);
                                        await context.sendActivity('An error occurred while trying to punch out. Please try again later.');
                                    }
                                }
                                
                                else if (context.activity.value && context.activity.value.action === 'confirmPunchOut') {
                                    const punchOutData = context.activity.value.punchOutData;
                                    console.log(punchOutData);

                                    const punchOutResponse = await callPunchOutAPI( accessToken, punchOutData);
                                    if (punchOutResponse) {
                                        await context.sendActivity(`Successfully punched Out`);
                                    } else {
                                        await context.sendActivity('Failed to punch out.');
                                    }

                                }
                                
                                else if (context.activity.value && context.activity.value.action === 'cancelPunchOut') {
                                    await context.sendActivity('Punch-out process canceled.');
                                }
                            } else {
                                await context.sendActivity('Authentication failed. Unable to call external API.');
                            }
                        } else {
                            await context.sendActivity('User not found.');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        await context.sendActivity('An error occurred while processing your request. Please try again later.');
                    }
                } else {
                    await context.sendActivity('AAD Object ID not found.');
                }
            } else {
                await context.sendActivity('Unhandled activity type.');
            }
        });
    });

})();












// const path = require('path');
// const restify = require('restify');
// const { BotFrameworkAdapter, CardFactory, MessageFactory } = require('botbuilder');

// // Import external API functions
// const {
//     login,
//     getUserByAadObjectId,
//     getAllUsers,
//     callAuthAPI,
//     callPunchStatusAPI,
//     callPunchInAPI
// } = require('./nms');
// const { log } = require('console');

// (async () => {
//     // Dynamic import for node-fetch
//     const fetch = (await import('node-fetch')).default;

//     // Set the global fetch polyfill
//     globalThis.fetch = fetch;

//     // Create adapter
//     const adapter = new BotFrameworkAdapter({
//         appId: 'f0abc9ea-46c5-48fa-9d78-07ef6e468e15',
//         appPassword: 'RRn8Q~aAiahjHjQ86uiQo3-D6cgq65nfmIoPibSn'
//     });

//     // Create HTTP server
//     const server = restify.createServer();
//     server.listen(process.env.port || process.env.PORT || 3978, function () {
//         console.log(`\n${server.name} listening to ${server.url}`);
//     });

//     server.post('/api/messages', async (req, res) => {
//         await adapter.processActivity(req, res, async (context) => {
//             if (context.activity.type === 'message') {
//                 const userId = context.activity.from.id;
//                 const userName = context.activity.from.name;
//                 const aadObjectId = context.activity.from.aadObjectId;
//                 // const text = context.activity.text.trim().toLowerCase();
//                 let selectedProjectCode;
    
//                 if (aadObjectId) {
//                     try {
//                         const user = await getUserByAadObjectId(aadObjectId);
//                         if (user) {
//                             console.log(`User Email: ${user.mail}`);
//                             await context.sendActivity(`User ID: ${userId}\nEmail: ${user.mail}`);
    
//                             const authResponse = await callAuthAPI(userId, user.mail);
//                             if (authResponse) {
//                                 console.log('Auth API call successful:', authResponse);
//                                 const accessToken = authResponse.accessToken;
//                                 const decodedToken = authResponse.decodedToken;
    
//                                 if (context.activity.text === 'punch in') {
//                                     const punchStatus = await callPunchStatusAPI(decodedToken.userId, accessToken);
//                                     console.log("Punch Status Response:", punchStatus);
    
//                                     if (punchStatus && punchStatus.data === "OUT") {
//                                         console.log("Fetching Projects");
//                                         const projectsResponse = await fetch('http://13.200.132.41:7070/api/v1/project/getAll', {
//                                             method: 'GET',
//                                             headers: {
//                                                 'Accept': 'application/json',
//                                                 'Authorization': `Bearer ${accessToken}`,
//                                                 'org-id': 'nintriva',
//                                                 'unit-id': 'default'
//                                             }
//                                         });
    
//                                         if (projectsResponse.ok) {
//                                             const projectsData = await projectsResponse.json();
//                                             console.log('Projects Data:', projectsData);
    
//                                             if (projectsData.status === 200 && projectsData.data.length > 0) {
//                                                 const buttons = projectsData.data.map(project => ({
//                                                     type: 'imBack',
//                                                     title: project.projectName,
//                                                     value: `select_project_${project.projectCode}`
//                                                 }));
    
//                                                 const card = CardFactory.heroCard(
//                                                     'Please select a project:',
//                                                     undefined,
//                                                     buttons
//                                                 );
    
//                                                 await context.sendActivity({ attachments: [card] });
//                                             } else {
//                                                 await context.sendActivity('No projects available to punch in.');
//                                             }
//                                         } else {
//                                             await context.sendActivity('Failed to fetch projects. Please try again later.');
//                                         }
//                                     } else {
//                                         await context.sendActivity('You are already punched in.');
//                                     }
//                                 } else if (context.activity.text === 'punch status') {
//                                     const punchStatus = await callPunchStatusAPI(decodedToken.userId, accessToken);
//                                     await context.sendActivity(`Punch Status: ${punchStatus.data}`);
//                                 } else if (context.activity.text.startsWith('select_project_')) {
//                                     // Store the selected project code and prompt for work mode
//                                     selectedProjectCode = context.activity.text.replace('select_project_', '');
//                                     console.log(`Selected Project Code: ${selectedProjectCode}`);
    
//                                     const workModeButtons = [
//                                         { type: 'imBack', title: 'WFO', value: `work_mode_WFO_${selectedProjectCode}` },
//                                         { type: 'imBack', title: 'WFH', value: `work_mode_WFH_${selectedProjectCode}` },
//                                         { type: 'imBack', title: 'On-site', value: `work_mode_On-site_${selectedProjectCode}` },
//                                         { type: 'imBack', title: 'HYBRID', value: `work_mode_HYBRID_${selectedProjectCode}` }
//                                     ];
    
//                                     const workModeCard = CardFactory.heroCard(
//                                         'Please select your work mode:',
//                                         undefined,
//                                         workModeButtons
//                                     );
    
//                                     await context.sendActivity({ attachments: [workModeCard] });
//                                 }else if (context.activity.text.startsWith('work_mode_')) {
//                                     const messageParts = context.activity.text.split('_');
//                                     console.log(messageParts);
//                                     const selectedWorkMode = messageParts[2];
//                                     const projectCode = messageParts[3];
//                                     console.log(`Selected Work Mode: ${selectedWorkMode}`);
//                                     console.log(`Selected Project Code: ${projectCode}`);
                                    
//                                     // Map the work mode to the corresponding punch location
//                                     const workModeMapping = {
//                                         'WFO': 'OFFICE',
//                                         'WFH': 'WORKFROMHOME',
//                                         'On-site': 'ONSITE',
//                                         'HYBRID': 'HYBRID'
//                                     };
                                    
//                                     const punchLocation = workModeMapping[selectedWorkMode];
//                                     console.log(`Selected punchLocation: ${punchLocation}`);
                                    
//                                     if (punchLocation && projectCode) {
//                                         // Call the punch-in API with the selected project code and work mode
//                                         const punchInResponse = await callPunchInAPI(decodedToken.userId, accessToken, projectCode, punchLocation);
//                                         if (punchInResponse) {
//                                             await context.sendActivity(`Successfully punched in to project ${projectCode} with work mode ${selectedWorkMode}.\nDetails: ${JSON.stringify(punchInResponse.data)}`);
//                                         } else {
//                                             await context.sendActivity('Failed to punch in.');
//                                         }
//                                     } else {
//                                         await context.sendActivity('Invalid work mode or project code.');
//                                     }
//                                 }else {
//                                     await context.sendActivity('Unhandled message received.');
//                                 }
//                             } else {
//                                 await context.sendActivity('Authentication failed. Unable to call external API.');
//                             }
//                         } else {
//                             await context.sendActivity('User not found.');
//                         }
//                     } catch (error) {
//                         console.error('Error:', error);
//                         await context.sendActivity('An error occurred while processing your request. Please try again later.');
//                     }
//                 } else {
//                     await context.sendActivity('AAD Object ID not found.');
//                 }
//             } else {
//                 await context.sendActivity('Unhandled activity type.');
//             }
//         });
//     });

// })();

