import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.OAUTH_CLIENT_ID || "",
      clientSecret: process.env.OAUTH_CLIENT_SECRET ||"",
      callbackURL: "https://real-estate-underwriter-server.onrender.com/api/v1/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      // Save user to DB if needed
      return done(null, profile);
    }
  )
);

export default passport;