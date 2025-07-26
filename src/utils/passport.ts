import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

let redirectUri:string | null=null;

const envType=process.env.ENV || "dev";

if(envType==="dev") redirectUri=process.env.REDIRECT_URI_DEV!;
else if(envType==="dep")redirectUri=process.env.REDIRECT_URI_DEV!;


passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.OAUTH_CLIENT_ID || "",
      clientSecret: process.env.OAUTH_CLIENT_SECRET ||"",
      callbackURL: redirectUri!,
    },
    (accessToken, refreshToken, profile, done) => {
      // Save user to DB if needed
      return done(null, profile);
    }
  )
);

export default passport;