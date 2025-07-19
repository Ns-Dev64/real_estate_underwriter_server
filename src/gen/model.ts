// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node

import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/genai';

export async function generateDealResult(prompt:string) {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const tools = [
    {
      googleSearch: {
      }
    },
  ];
  const config = {
    thinkingConfig: {
      thinkingBudget: -1,
    },
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,  // Block most
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,  // Block most
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,  // Block most
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,  // Block most
      },
    ],
    tools,
    responseMimeType: 'text/plain',
    systemInstruction: [
        {
          text: `Objective

Evaluate multifamily real estate investment opportunities using:

- T12 financials  
- Property-level metadata (now includes estimated property value)  
- User-supplied deal terms  

Return a PASS, FAIL, or INCONCLUSIVE decision with a confidence score, structured reasoning, investment metrics, and risk commentary.

Expected Input Format

You will be provided with an object containing the following (userInputs may be partially missing):

{
  "userInputs": {
    "buyBox": {
      "minYearBuilt": ,
      "minCoCReturn": ,
      "minCapRate": ,
      "maxPurchasePrice": ,
      "minUnits": ,
      "preferredMarkets": eg ["Tampa", "Orlando", "Jacksonville"]
    },
    "assumptions": {
      "askingPrice": ,
      "downPayment": ,
      "interestRate": ,
      "loanTerm": ,
      "exitCapRate": ,
      "exitYear": 
    }
  },
  "t12": { ... },
  "propertyDetails": {
    "propertyValue":,
    ...
  }
}

Processing Workflow

1. Sanitize and Extract Data  
  - Normalize raw T12 data  
  - Safely parse missing, malformed, or abbreviated entries  
  - Use defaults where reasonable, flag if not  

2. Financial Calculations  
  - NOI = grossPotentialRent + otherIncome - totalOperatingExpenses  
  - Cap Rate = NOI / Property Value (from propertyDetails.propertyValue, not askingPrice)  
  - Expense Ratio = totalOperatingExpenses / (grossPotentialRent + otherIncome)  
  - CoC = (NOI - Annual Debt Service) / Total Cash Invested  

    Annual Debt Service = Loan Amount × [Interest × (1 + Interest)^Term] / [(1 + Interest)^Term - 1]  

  - DSCR = NOI / Annual Debt Service  
  - IRR requires hold period (default: 5 years if exitYear is not provided)  

    Exit Price = NOI in final year / Exit Cap Rate  

    Cash Flows:  
    - Year 0: -Down Payment  
    - Years 1–n: Annual Cash Flow = NOI - Debt Service  
    - Final Year: Add Exit Price to final year's cash flow  

3. Market/Neighborhood Checks  
  - Crime Rating: Must be B or above  
  - School Ratings:  
    - A-B = Acceptable  
    - C = okish
    - C- and above =Risk  
  - Year Built Gap:  
    If absolute difference between BuildDate and UserExpectedDate is greater than 5, flag as quality mismatch  

4. Price Per Unit Benchmarking  
  - Calculated as: Property Value / Total Units

Output Format

{
  "decision": "PASS" | "FAIL" | "INCONCLUSIVE",
  "confidence": "95%",
  "reasoning": [
    "Cap rate is 5.94% which is below the 6% threshold.",
    "Expense ratio is 12.3%, unrealistically low.",
    "Crime rating is B-, school rating is 6."
  ],
  "metrics": {
    "capRate": 0.0594,
    "cocReturn": 0.047,
    "irr": 0.1112,
    "dscr": 1.18,
    "pricePerUnit": 125000,
    "expenseRatio": 0.123
  },
  "risks": [
    "Cap rate is below target threshold.",
    "Unrealistically low reported expenses.",
    "Crime rating may reduce tenant quality."
  ]
}

Evaluator Behavior

- If inputs required for CoC/IRR/DSCR are missing:
  - Set those metrics to null
  - Mention in reasoning: "Insufficient inputs to calculate IRR" (etc.)

Dealbreaker Triggers

Metric: Expense Ratio  
Threshold: < 30%  
Interpretation: Likely underreported  

Metric: Cap Rate  
Threshold: < 6%  
Interpretation: Weak deal yield  

Metric: DSCR  
Threshold: < 1.2  
Interpretation: Risk of default  

Metric: CoC Return  
Threshold: < 6–8%  
Interpretation: Poor investor returns  

Metric: Crime Rating  
Threshold: Below B  
Interpretation: Safety/liability concerns  

Metric: School Ratings  
Threshold: < B- (get an average of all the school ratings if there are multiple schools)
Interpretation: Weak tenant demand area  

Additional Notes

- Always explain how and why you came to your decision  
- Be conservative — lack of information is a negative signal  
- Return clear numeric metrics and flag missing data`,
        }
    ],
  };
  const model = 'gemini-2.5-pro';
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `{
    "userData": {
        "buyBox": {
            "minYearBuilt": 1900,
            "minCoCReturn": 8,
            "minCapRate": 6,
            "maxPurchasePrice": 915400,
            "minUnits": 1,
            "preferredMarkets": []
        },
        "assumptions": {
            "askingPrice": 505300,
            "downPayment": 25,
            "interestRate": 7,
            "loanTerm": 30,
            "exitCapRate": 6,
            "exitYear": 5
        }
    },
    "t12Data": {
        "totalIncome": 1190000,
        "totalExpenses": 470000,
        "netOperatingIncome": 720000
    },
    "rentRollData": {
        "units": [
            {
                "tenantName": "John Doe",
                "leaseStart": "2024-01-01",
                "leaseEnd": "2025-01-01",
                "rentAmount": 0,
                "status": "Occupied"
            },
            {
                "tenantName": "Jane Smith",
                "leaseStart": "2024-03-01",
                "leaseEnd": "2025-03-01",
                "rentAmount": 200,
                "status": "Occupied"
            },
            {
                "tenantName": "Alice Johnson",
                "leaseStart": "2024-05-01",
                "leaseEnd": "2025-05-01",
                "rentAmount": 0,
                "status": "Occupied"
            },
            {
                "tenantName": "Bob Brown",
                "leaseStart": "2024-06-01",
                "leaseEnd": "2025-06-01",
                "rentAmount": 100,
                "status": "Occupied"
            }
        ],
        "rawData": [
            {
                "Unit": "101",
                "Tenant Name": "John Doe",
                "Lease Start": "2024-01-01",
                "Lease End": "2025-01-01",
                "Monthly Rent": 1000,
                "Security Deposit": 1000,
                "Current Balance": 0
            },
            {
                "Unit": "102",
                "Tenant Name": "Jane Smith",
                "Lease Start": "2024-03-01",
                "Lease End": "2025-03-01",
                "Monthly Rent": 1200,
                "Security Deposit": 1200,
                "Current Balance": 200
            },
            {
                "Unit": "103",
                "Tenant Name": "Alice Johnson",
                "Lease Start": "2024-05-01",
                "Lease End": "2025-05-01",
                "Monthly Rent": 1100,
                "Security Deposit": 1100,
                "Current Balance": 0
            },
            {
                "Unit": "104",
                "Tenant Name": "Bob Brown",
                "Lease Start": "2024-06-01",
                "Lease End": "2025-06-01",
                "Monthly Rent": 1050,
                "Security Deposit": 1050,
                "Current Balance": 100
            }
        ],
        "totalUnits": 4,
        "occupiedUnits": 4,
        "vacantUnits": 0,
        "occupancyRate": 100,
        "totalRent": 4650,
        "averageRent": 1162.5
    },
    "propertyData": {
        "address": "1701 S Kingsley Dr, Los Angeles, CA 90006",
        "propertyType": "DUPLEX (2 UNITS, ANY COMBINATION)",
        "propertyYear": 1906,
        "propertyUnit": "2",
        "propertyCrimeRating": "F",
        "propertyMedianIncome": 70833,
        "propertyAvgIncome": 114426,
        "propertySchoolsAndRating": [
            {
                "InstitutionName": "Bright Elementary School",
                "schoolRating": "C "
            },
            {
                "InstitutionName": "24th Street Elementary School",
                "schoolRating": "B-"
            },
            {
                "InstitutionName": "West Adams Preparatory High School",
                "schoolRating": "D+"
            },
            {
                "InstitutionName": "Carson - Gore Academy of Enviornmental Studies",
                "schoolRating": "C+"
            },
            {
                "InstitutionName": "Pico Pico Middle School",
                "schoolRating": "C-"
            }
        ],
        "propertyEstimatedValue": 677900,
        "propertyMinValue": 505300,
        "propertyMaxValue": 915400
    }
}`,
        },
      ],
    },
    {
      role: 'model',
      parts: [
        {
          text: `**Analyzing the Inputs**

I've started by parsing the provided JSON data to extract the relevant inputs. This includes the user's \`buyBox\` and \`assumptions\`, alongside the T12 financial data. The next step is data sanitization. I'll need to check the data types and ensure the extracted data is ready for financial modeling.


**Evaluating Data Integrity**

I've completed the initial data parsing, focusing on extracting the \`buyBox\` and \`assumptions\`, and the critical T12 financial figures. I've noted a significant discrepancy between the T12 financials, particularly the income and the property's unit count (4 units) and rent roll data ($4,650/month). The T12 shows income of $1.2M and $720k NOI, which is not aligned with 4 units; the correct calculated GPR is $55,800. I plan to use the T12 data, but I'll flag this as a major inconsistency. Additionally, I've confirmed the property has 4 units per the rent roll.


**Refining Financial Model**

I've now re-calculated the property's financial performance using the provided rent roll, identifying significant discrepancies with the initial T12 data. Based on a 5% vacancy rate and a conservative 50% expense ratio, the estimated NOI now sits at $26,505, a far cry from the original figures. This revised approach will provide a more realistic basis for the investment analysis. The provided T12 data is unusable.


**Constructing the Financials**

I've completed the initial extraction and data cleaning, identifying the significant T12 inconsistencies. My strategy is to develop a pro-forma based on the rent roll data and reasonable assumptions. The analysis will now proceed with calculating income and expenses based on the rent roll information and my own industry expertise to construct a financial model. The previous T12 financials will be unusable.


**Constructing Projections**

I've established the financial model based on the rent roll and conservative assumptions. I've calculated a negative cash flow and low debt service coverage ratio using the user's input. To determine the internal rate of return, I'll project cash flows and determine the loan balance at the end of the holding period. This will finalize the investment analysis.


**Evaluating Property Performance**

I've completed extracting key data, including the user's input \`buyBox\` and \`assumptions\`, along with the \`propertyDetails\`. I've constructed a more reliable financial model using the \`rentRollData\`, recognizing the T12 data's unsuitability. The result is a more accurate property performance assessment. The T12 financials have been deemed unreliable. I've re-calculated the financials using the rent roll to determine a more realistic approach, and I'll proceed with this model.



**Evaluating Rent Roll Data**

I've now re-calculated the property's financial performance using the provided rent roll. Using the rent roll, I've determined gross potential rent to be $55,800 and have estimated a 50% expense ratio and a 5% vacancy rate. The provided T12 data is unusable, showing income and expenses far greater than are possible for a 4-unit property. This revised approach offers a realistic basis for further investment analysis.


**Calculating Debt Service**

I've determined the annual debt service based on the provided loan terms, which is $30,244.20. Subsequently, I calculated the cash-on-cash return, coming in at -2.96%. The Debt Service Coverage Ratio is also calculated at 0.88. I've also re-calculated the IRR.


**Refining Financial Model and Analysis**

I've completed the preliminary analysis, including the parsing and cleaning of inputs. The model now relies on the \`rentRollData\`, factoring in the discrepancy with the provided T12 data. Based on the reconstructed financials, I've calculated a negative cash flow and low debt service coverage ratio. The internal rate of return calculation is also in progress. I have also added market/neighborhood risk analysis.

`,
        },
        {
          text: `\`\`\`json
{
  "decision": "FAIL",
  "confidence": "100%",
  "reasoning": [
    "The DSCR is 0.88, which is critically below the 1.2 minimum threshold, indicating the property's income cannot cover the proposed debt service.",
    "The property has a negative cash-on-cash return of -2.96%, failing to meet the user's 8% minimum requirement and resulting in an immediate operating loss for the investor.",
    "The 'F' crime rating is a dealbreaker, suggesting significant safety and liability concerns that will likely impact tenant quality and retention.",
    "The provided T12 financials are grossly inconsistent with the rent roll and unit count, indicating a major data error or misrepresentation. Financials were reconstructed using the rent roll and standard assumptions.",
    "The average school rating is 'C', which is below the preferred 'B-' minimum, potentially weakening tenant demand."
  ],
  "metrics": {
    "capRate": 0.0391,
    "cocReturn": -0.0296,
    "irr": -0.0361,
    "dscr": 0.88,
    "pricePerUnit": 126325,
    "expenseRatio": 0.475
  },
  "risks": [
    "Critical Default Risk: With a DSCR below 1.0, the property is projected to not generate enough income to make its loan payments, leading to a high probability of default.",
    "Severe Data Inconsistency: The provided T12 NOI of $720,000 is impossible for a 4-unit property with a monthly rent roll of $4,650. This discrepancy makes the seller's data completely unreliable.",
    "High-Crime Area: An 'F' crime rating presents significant operational challenges, including higher vacancy, tenant turnover, vandalism, and increased insurance costs.",
    "Negative Cash Flow: The investment is projected to lose money annually before considering any capital expenditures.",
    "Potential Zoning Violation: The property is listed as a 'Duplex (2 Units)' but is being operated with 4 units, posing a risk of legal and zoning non-compliance."
  ]
}
\`\`\``,
        },
      ],
    },
    {
      role: 'user',
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ];

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });

  let res = '';

for await (const chunk of response) {
  const text = chunk.text;
  res += text;
}
  return res
}

