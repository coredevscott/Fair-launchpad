import { Request, Response, NextFunction } from "express";
import { omit } from "lodash";
import AppError from "../utils/appError";
import verifyJwt from "../utils/jwt";
import User from "../models/User";

// Extend Express' Request interface to include the 'user' property
interface CustomRequest extends Request {
  user?: any; // Ideally, replace `any` with the actual user type/interface
}

const auth = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    let access_token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      access_token = req.headers.authorization.split(" ")[1];
    }

    if (!access_token) {
      return next(new AppError(401, "You are not logged in"));
    }

    // Validate the access token
    const decoded = verifyJwt(access_token);
    if (!decoded) {
      return next(new AppError(401, `Invalid token or user doesn't exist`));
    }
    // console.log("decoded---->", decoded)
    // Check if the user still exists
    const  user_id  = decoded.user._id;

    const user = await User.findOne({ _id: user_id }).populate("groups.groupId");
    if (!user) {
      return next(new AppError(401, `Invalid token or session has expired`));
    }

    // Add user to req
    req.user = user;

    next();
  } catch (err) {
    next(err);
  }
};

export default auth;
