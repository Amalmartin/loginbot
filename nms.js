// const { Client } = require('@microsoft/microsoft-graph-client');
// const { DefaultAzureCredential } = require('@azure/identity');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const globalThis = require('globalthis')();
globalThis.fetch = fetch;
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
const { ClientSecretCredential } = require('@azure/identity');
require('dotenv').config();

async function main() {
    const tenantId = process.env.MicrosoftAppTenantId;
    const clientId = process.env.MicrosoftAppId;
    const clientSecret = process.env.MicrosoftAppPassword;

    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

    // Fetch the token (just for logging, not necessary in actual client init)
    const token = await credential.getToken(['https://graph.microsoft.com/.default']);
    console.log('Access Token:', token.token);

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ['https://graph.microsoft.com/.default']
    });

    console.log('AuthProvider:', authProvider);

    const client = Client.initWithMiddleware({ authProvider });
    console.log('Graph Client:', client);

    return client;
}

async function getUserEmail(client, aadObjectId) {
    try {
        const user = await client.api(`/users/${aadObjectId}`).get();
        console.log(`User data: ${JSON.stringify(user)}`);
        return user.mail; // Get the user's email
    } catch (error) {
        console.error(`Error fetching user email: ${error.message}`);
        return null;
    }
}

async function getUserByAadObjectId(context) {
    const client = await main();
    const aadObjectId = context.activity.from.aadObjectId;

    if (aadObjectId) {
        const email = await getUserEmail(client, aadObjectId);
        if (email) {
            await context.sendActivity(`Your email address is: ${email}`);
        } else {
            await context.sendActivity(`Sorry, I couldn't fetch your email address.`);
        }
    } else {
        await context.sendActivity(`I couldn't identify your user ID.`);
    }
}
async function getAccessToken() {
    console.log(2);
    const response = await axios.post(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: scope
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
// console.log(response);
    return response.data.access_token;
}

// async function getUserByAadObjectId(aadObjectId) {
//     console.log(
//         1
//     );
//     const token = await getAccessToken();
// console.log(token);
//     const userResponse = await axios.get(`https://graph.microsoft.com/v1.0/users/${aadObjectId}`, {
//         headers: {
//             'Authorization': `Bearer ${token}`
//         }
//     });
//     // const userEmail = userResponse.data.mail || userResponse.data.userPrincipalName;
//     console.log(`User email: ${userResponse}`);
//     return userResponse.data;
// }

async function getAllUsers() {
    try {
        const users = [];
        let response = await client.api('/users').get();

        while (response) {
            users.push(...response.value);
            response = response['@odata.nextLink'] ? await client.api(response['@odata.nextLink']).get() : null;
        }

        return users;
    } catch (error) {
        return null;
    }
}

async function callAuthAPI(userId, email) {
    try {
        const response = await fetch(`${base_url}auth/appAuth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'org-id': 'nintriva',
                'unit-id': 'default'
            },
            body: JSON.stringify({
                data: {
                    appUserId: userId,
                    email: email
                }
            })
        });

        const data = await response.json();
        const decodedToken = jwt.decode(data.data.accessToken);

        if (response.ok) {
            return { accessToken: data.data.accessToken, decodedToken };
        } else {
            throw new Error(data.message || 'Failed to authenticate');
        }
    } catch (error) {
        return null;
    }
}

async function callPunchStatusAPI(userId, accessToken) {
    try {
        const response = await fetch(`${base_url}punch/punchStatus?userId=${userId}`, {
            method: 'GET',
            headers: {
                'accept': '*/*',
                'Authorization': `Bearer ${accessToken}`,
                'org-id': 'nintriva'
            }
        });

        const data = await response.json();

        if (response.ok) {
            return data;
        } else {
            throw new Error(data.message || 'Failed to fetch punch status');
        }
    } catch (error) {
        return null;
    }
}

async function callPunchInAPI(empId, accessToken, projectCode, punchLocation, task) {
    try {
        const payload = {
            data: {
                empId: empId,
                punchInDateTime: Math.floor(Date.now() / 1000),
                punchLocation: punchLocation,
                projectCode: projectCode,
                shiftDate: Math.floor(new Date().setHours(0, 0, 0, 0) / 1000),
                task: task,
                isOnBreak: false,
                description: ""
            }
        };

        const response = await fetch(`${base_url}punch/punchIn`, {
            method: 'POST',
            headers: {
                'Accept': '*/*',
                'Authorization': `Bearer ${accessToken}`,
                'org-id': 'nintriva',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        let data;
        if (response.headers.get('content-length') !== '0') {
            data = await response.json();
        } else {
            data = null;
        }

        if (response.ok) {
            return data;
        } else if (response.status === 403) {
            throw new Error('Forbidden: Check your access token and permissions.');
        } else {
            throw new Error(data?.message || 'Failed to punch in');
        }
    } catch (error) {
        return null;
    }
}

async function fetchProjects(accessToken) {
    try {
        const projectsResponse = await fetch(`${base_url}project/getAll`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'org-id': 'nintriva',
                'unit-id': 'default'
            }
        });
        return projectsResponse;
    } catch (error) {
        console.error('Error fetching projects:', error);
    }
}

async function callPunchOutResponse(accessToken, userId) {
    try {
        const punchOutResponse = await fetch(`${base_url}punch/lastPunchIn?userId=${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'org-id': 'nintriva',
                'unit-id': 'default'
            }
        });
        if (punchOutResponse.ok) {
            return punchOutResponse;
        } else {
            const data = await punchOutResponse.json();
            console.error('Failed to fetch punch out response:', data.message);
        }
    } catch (error) {
        console.error('Error fetching punch out response:', error);
    }
}

async function callPunchOutAPI(accessToken, punchOutData) {
    try {
        const punchOut = await fetch(`${base_url}punch/punchOut`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'org-id': 'nintriva',
                'unit-id': 'default'
            },
            body: JSON.stringify({
                data: {
                    empId: punchOutData.empId,
                    shiftDate: punchOutData.shiftDate,
                    punchOutDateTime: Math.floor(Date.now() / 1000),
                    punchLocation: punchOutData.punchLocation,
                    projectCode: punchOutData.projectCode,
                    task: punchOutData.task,
                    description: punchOutData.description,
                    isOnBreak: punchOutData.isOnBreak
                }
            })
        });

        if (punchOut.status === 403) {
            throw new Error('Forbidden: Check your access token and permissions.');
        }

        if (punchOut) {
            return punchOut;
        }

    } catch (error) {
        return null;
    }
}

module.exports = {
    getUserByAadObjectId,
    callAuthAPI,
    callPunchStatusAPI,
    callPunchInAPI,
    callPunchOutResponse,
    callPunchOutAPI,
    fetchProjects
};
