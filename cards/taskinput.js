const taskInputCard = (projectCode, selectedWorkMode) => ({
    type: "AdaptiveCard",
    body: [
        {
            type: "TextBlock",
            text: "Please enter your task:",
            weight: "Bolder",
            size: "Medium"
        },
        {
            type: "Input.Text",
            id: "task",
            placeholder: "Enter your task here"
        }
    ],
    actions: [
        {
            type: "Action.Submit",
            title: "Submit",
            data: {
                action: "submitTask",
                projectCode: projectCode,
                selectedWorkMode: selectedWorkMode
            }
        }
    ],
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.3"
});

module.exports = taskInputCard