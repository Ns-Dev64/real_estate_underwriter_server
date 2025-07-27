import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import  connectDB  from "../db/init";

const JWT_SECRET = process.env.JWT_SECRET as string;

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
      { expiresIn: "2h" }
    );

    res.status(200).json({ token, username: user.userName });
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

  console.log('ENV:',process.env.ENV);
  console.log("frontendUrl:",frontendUrl)
  try{
    const token=jwt.sign(
      {userId:id,email:email},
      JWT_SECRET,
      { expiresIn: "2h" }
    );   


    
  res.redirect(`${frontendUrl}/auth/callback?token=${token}&email=${email}&user=${req.user?.displayName}`);
  }
  catch(err){
     res.redirect(`${frontendUrl}/auth/callback?error=${err}`)

  }

}