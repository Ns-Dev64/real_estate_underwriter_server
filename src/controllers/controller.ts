import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { 
  T12Data, 
  RentRollData, 
  parseExcelFile, 
  parseCSVFile, 
  parsePDFFile, 
  extractT12Data, 
  extractRentRollData 
} from '../utils/helpers';
import { generateDealResult } from '../gen/model';
import { constructPrompt } from '../gen/prompt';
import axios from 'axios';

const BASE_PROPERTY_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0/attomavm/detail?';
const BASE_NEIGHBOURHOOD_URL = 'https://api.gateway.attomdata.com/v4/neighborhood/community?';
const BASE_SCHOOL_URL = 'https://api.gateway.attomdata.com/propertyapi/v4/property/detailwithschools?'


export const parseT12Controller = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let parsedData: T12Data;
    
    try {
      if (fileExtension === '.pdf') {
        const pdfText = await parsePDFFile(filePath);
        parsedData = extractT12Data(pdfText, 'pdf');
      } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        const excelData = parseExcelFile(filePath);
        parsedData = extractT12Data(excelData, 'excel');
      } else {
        return res.status(400).json({ error: 'Unsupported file format for T12. Please use PDF or Excel files.' });
      }
      
      fs.unlinkSync(filePath);
      
      res.json({
        success: true,
        message: 'T12 file parsed successfully',
        data: parsedData,
        fileInfo: {
          originalName: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype
        }
      });
      
    } catch (parseError) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw parseError;
    }
    
  } catch (error) {
    console.error('Error parsing T12 file:', error);
    res.status(500).json({ 
      error: 'Failed to parse T12 file', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export const parseRentRollController = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let parsedData: RentRollData;
    
    try {
      if (fileExtension === '.csv') {
        const csvData = parseCSVFile(filePath);
        parsedData = extractRentRollData(csvData, 'csv');
      } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        const excelData = parseExcelFile(filePath);
        parsedData = extractRentRollData(excelData, 'excel');
      } else {
        return res.status(400).json({ error: 'Unsupported file format for Rent Roll. Please use CSV or Excel files.' });
      }
      
      fs.unlinkSync(filePath);
      
      res.json({
        success: true,
        message: 'Rent Roll file parsed successfully',
        data: parsedData,
        fileInfo: {
          originalName: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype
        }
      });
      
    } catch (parseError) {
      // Clean up uploaded file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw parseError;
    }
    
  } catch (error) {
    console.error('Error parsing Rent Roll file:', error);
    res.status(500).json({ 
      error: 'Failed to parse Rent Roll file', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export const getPropertyDetails=async(req:Request,res:Response)=>{

    try {

        const address = req.query.address?.toString();

        if (!address) return res.status(400).send("Address required");

        const apiKey = process.env.ATTOM_API_KEY;
        const uri = constructURL(address);
        const headers = {
            'Accept': 'application/json',
            'apiKey': `${apiKey}`,
        }

        const propertyResponse = await axios.get(uri, {
            headers: headers
        });

        if (propertyResponse.data.status.msg !== "SuccessWithResult") return res.status(400).send(propertyResponse.data.status.msg);

        
        const attomId = propertyResponse.data.status.attomId;
        const propertyData = propertyResponse.data.property;

        const summary = propertyData[0].summary;
        const buildingSummary = propertyData[0].building.summary;
        const avm=propertyData[0].avm;
        const geoIdV4 = propertyData[0].location.geoIdV4.PL;


        const value=avm.amount.value;
        const low=avm.amount.low;
        const high=avm.amount.high;
        const confidence=avm.amount.confidence;

        const neighborhoodURL = `${BASE_NEIGHBOURHOOD_URL}geoIdV4=${geoIdV4}`;
        const schoolURL = `${BASE_SCHOOL_URL}attomId=${attomId}`;
        
        const {streetCity,stateZip}=splitAddress(address);

        const [neighborhoodResponse, schoolResponse] = await Promise.all([
            axios.get(neighborhoodURL, {
                headers: headers
            }),
            axios.get(schoolURL, {
                headers: headers
            }),
 
           
        ])

        const crimeIndex = neighborhoodResponse.data.community.crime.crime_Index;
        const medianHouseholdIncome = neighborhoodResponse.data.community.demographics.median_Household_Income;
        const avgHouseholdIncome = neighborhoodResponse.data.community.demographics.avg_Household_Income;

        const schools = schoolResponse.data.property[0].school;

        const schoolRatings = schools.map((school: any) => ({
            InstitutionName: school.InstitutionName,
            schoolRating: school.schoolRating
        }));

        let crimeRating:string =getCrimeRating(crimeIndex);

        const propertyPayload={
            propertyType:summary.propertyType,
            propertyYear:summary.yearbuilt,
            propertyUnit:buildingSummary.unitsCount ? buildingSummary.unitsCount : buildingSummary.size?.livingsize || "",
            propertyCrimeRating:crimeRating,
            propertyMedianIncome:medianHouseholdIncome,
            propertyAvgIncome:avgHouseholdIncome,
            propertySchoolsAndRating:schoolRatings,
            propertyValueConfidence:confidence,
            propertyEstimatedValue:value,
            propertyMinValue:low,
            propertyMaxValue:high
        }

        return res.status(200).json({message:"details fetched",data:propertyPayload})

    } catch (err: any) {
        console.error(err);
        return res.status(400).send(err)
    }

}

export const getDealOutput=async(req:Request,res:Response)=>{

  try{

    const {userData,t12Data,rentRollData,propertyData}=req.body;

    if(!userData || !t12Data || !rentRollData || !propertyData) return res.status(400).send("Missing paramters in body");

    const prompt=constructPrompt(userData,t12Data,rentRollData,propertyData);

    const response=await generateDealResult(prompt);
    const raw = response.replace(/```json\n?/, "").replace(/```$/, "");
    const parsed = JSON.parse(raw);

    return res.status(200).json({message:"response fetched",data:parsed})

  }
  catch(err:any){
    console.error(err);
    return res.status(400).send(err)
  }

}


function getCrimeRating(crimeIndex: number): string {
  if (crimeIndex >= 90) return 'F';
  if (crimeIndex >= 80) return 'D-';
  if (crimeIndex >= 70) return 'D';
  if (crimeIndex >= 60) return 'D+';
  if (crimeIndex >= 50) return 'C-';
  if (crimeIndex >= 40) return 'C';
  if (crimeIndex >= 30) return 'C+';
  if (crimeIndex >= 20) return 'B-';
  if (crimeIndex >= 10) return 'B';
  if (crimeIndex >= 5)  return 'B+';
  if (crimeIndex >= 2)  return 'A-';
  return 'A+';
}


function constructURL(address: string) {

    const { streetCity, stateZip } = splitAddress(address)

    const query = `address1=${encodeURIComponent(streetCity)}&address2=${encodeURIComponent(stateZip)}`

    return `${BASE_PROPERTY_URL}${query}`
}


function splitAddress(fullAddress: string): { streetCity: string; stateZip: string } {
    const parts = fullAddress.split(",");
    if (parts.length < 3) throw new Error("Invalid address format");

    const streetCity = parts.slice(0, 2).join(",").trim();
    const stateZip = parts[2].trim();

    return { streetCity, stateZip };
}

