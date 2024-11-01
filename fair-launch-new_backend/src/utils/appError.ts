class AppError extends Error {
    status: string;
    isOperational: boolean;
  
    constructor(statusCode: number = 500, message: string) {
      super(message);
      this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
      this.isOperational = true;
  
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  export default AppError;
  