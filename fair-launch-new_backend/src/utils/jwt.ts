import jwt, { JwtPayload } from "jsonwebtoken";

// Function to verify a JWT token
// The function now returns a JwtPayload or null, indicating the decoded token or lack thereof
const verifyJwt = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    return decoded as JwtPayload;
  } catch (error) {
    return null;
  }
};

export default verifyJwt;