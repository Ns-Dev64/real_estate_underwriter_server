

export function constructPrompt(userData:any, t12Data:any, rentRollData:any, propertyDetails:any) {

    const realEstatePrompt = `
                User Inputs:
                \`\`\`json
                ${JSON.stringify(userData, null, 2)}
                \`\`\`

                T12 Parsed Data (Raw Financials):
                \`\`\`json
                ${JSON.stringify(t12Data, null, 2)}
                \`\`\`

                Rent Roll Parsed Data:
                \`\`\`json
                ${JSON.stringify(rentRollData, null, 2)}
                \`\`\`

                Property Details:
                \`\`\`json
                ${JSON.stringify(propertyDetails, null, 2)}
                \`\`\`
                `;


        return realEstatePrompt;
}