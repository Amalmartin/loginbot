const punchOutDetails = `Do you want to confirm punch-out?`;

const PunchOutCard = (punchOutData) => ({
    type: "AdaptiveCard",
    body: [
        {
            type: "TextBlock",
            text: punchOutDetails,
            wrap: true
        }
    ],
    actions: [
        {
            type: "Action.Submit",
            title: "Confirm",
            data: {
                action: "confirmPunchOut",
                punchOutData: punchOutData.data
            }
        },
        {
            type: "Action.Submit",
            title: "Cancel",
            data: {
                action: "cancelPunchOut"
            }
        }
    ],
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.3"
});

module.exports = PunchOutCard;
