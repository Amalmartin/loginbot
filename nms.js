const { Client } = require('@microsoft/microsoft-graph-client');
const { ManagedIdentityCredential } = require('@azure/identity');
const fetch = require('node-fetch');
const globalThis = require('globalthis')();
globalThis.fetch = fetch;

const credential = new ManagedIdentityCredential();

const client = Client.initWithMiddleware({
    authProvider: {
        getAccessToken: async () => {
            try {
                const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');
                console.log('Token acquired:', tokenResponse.token);
                return tokenResponse.token;
            } catch (error) {
                console.error('Failed to acquire token:', error);
                throw error;
            }
        }
    }
});

async function getUserByAadObjectId(aadObjectId) {
    try {
        console.log('Fetching user with AAD Object ID:', aadObjectId);
        const user = await client.api(`/users/${aadObjectId}`).get();
        console.log('User retrieved:', user);
        return user;
    } catch (error) {
        console.error('Error fetching user:', error);
        return null;
    }
}
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
