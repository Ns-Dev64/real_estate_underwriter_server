import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import  connectDB  from "../db/init";
import type{ AuthPayload } from "../middleware/authMiddleware";
import { ObjectId } from "mongodb";

const JWT_SECRET = process.env.JWT_SECRET as string;
const REFRESH_SECRET=process.env.REFRESH_SECRET as string;

export const register = async (req: Request, res: Response) => {
  const { email, userName, password } = req.body;

  try {
    const db = await connectDB();
    const users = db.collection("users");

    const existing = await users.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await users.insertOne({
      email,
      userName,
      password: hashedPassword,
    });

    res.status(201).json({ message: "User created", userId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const db = await connectDB();
    const users = db.collection("users");

    const user = await users.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      JWT_SECRET,
      { expiresIn: "3h" }
    );

    const refreshToken=jwt.sign(
      { userId: user._id.toString(), email: user.email },
      REFRESH_SECRET,
      { expiresIn: "30d" }
    )
    
   await users.updateOne({email},{$set:{
    refreshToken
   }},{upsert:true});




    res.status(200).json({ token,refreshToken, username: user.userName });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
};

export const oauthLogin=async(req:Request,res:Response)=>{

  const email=req.user?.emails![0].value;
  const id= req.user?.id;

   let frontendUrl:string | null=null;
    const envType=process.env.ENV || "dev";
  if(envType==="dev") frontendUrl=process.env.FRONTEND_URI_DEV!;
  else if(envType==="dep") frontendUrl=process.env.FRONTEND_URI_DEP!;
  
  try{

    const db = await connectDB();
    const users = db.collection("users");
    

    const user=await users.findOne({oauthId:id});

    if(!user){
      await users.insertOne({
        oauthId:id,
        email:email,
        userName:req.user?.displayName
      });
    }
   

    const token=jwt.sign(
      {userId:user?._id,email:email},
      JWT_SECRET,
      { expiresIn: "3h" }
    );   
    
    const refresh=jwt.sign(
      {userId:user?._id,email:email},
      REFRESH_SECRET,
      {expiresIn:"30d"}
    );

  res.redirect(`${frontendUrl}/auth/callback?token=${token}&refresh=${refresh}&email=${email}&user=${req.user?.displayName}`);
  }
  catch(err){
     res.redirect(`${frontendUrl}/auth/callback?error=${err}`)
  }

}


export const refreshToken=async(req:Request,res:Response)=>{

try{

      const db = await connectDB();
    const users = db.collection("users");

  const refreshToken=req.body.refreshToken as string;

  if(!refreshToken) throw new Error("Missing token");

  const payload= jwt.verify(refreshToken,REFRESH_SECRET) as AuthPayload;

  const user=await users.findOne({
    _id:new ObjectId(payload?.userId)
  })


  if(!user) throw new Error("User doesn't exist");

  if(refreshToken!==user.refreshToken) throw new Error("Invalid refresh Token");

  const jwtToken=jwt.sign({
    userId:user._id.toString(),email:user.email
  },JWT_SECRET,{
    expiresIn:'3h'
  })

  return res.status(200).json({token:jwtToken,user:user.userName});

}
catch(err){
 res.status(500).json({ error: "Error occured while refreshin Token. Please login again",err });

}


}