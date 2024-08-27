const projectSelectionCard = (projects) => ({
    type: "AdaptiveCard",
    body: [
        {
            type: "TextBlock",
            text: "Please select a project:",
            weight: "Bolder",
            size: "Medium"
        },
        {
            type: "Input.ChoiceSet",
            id: "projectCode",
            style: "compact",
            choices: projects.map(project => ({
                title: project.projectName,
                value: project.projectCode
            }))
        }
    ],
    actions: [
        {
            type: "Action.Submit",
            title: "Select",
            data: {
                action: "selectProject"
            }
        }
    ],
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.3"
});

module.exports = projectSelectionCard