const workModeSelectionCard = (projectCode) => ({
    type: "AdaptiveCard",
    body: [
        {
            type: "TextBlock",
            text: "Please select your work mode:",
            weight: "Bolder",
            size: "Medium"
        },
        {
            type: "Input.ChoiceSet",
            id: "workMode",
            style: "expanded",
            choices: [
                { title: "WFO", value: "OFFICE" },
                { title: "WFH", value: "WORKFROMHOME" },
                { title: "On-site", value: "ONSITE" },
                { title: "HYBRID", value: "HYBRID" }
            ]
        }
    ],
    actions: [
        {
            type: "Action.Submit",
            title: "Select",
            data: {
                action: "selectWorkMode",
                projectCode: projectCode
            }
        }
    ],
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.3"
});

module.exports = workModeSelectionCard;