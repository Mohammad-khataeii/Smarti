// auth.mjs
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { initializeDatabase } from './db.mjs';

const db = await initializeDatabase();

// Configure the local strategy for Passport
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = await db.get('SELECT * FROM users WHERE username = ?', username);

      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return done(null, false, { message: 'Incorrect password.' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Serialize and deserialize user information for session management
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
