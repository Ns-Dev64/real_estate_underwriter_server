declare namespace Express {
  export interface Request {
    user?: {
      id?:string;
      userId: string;
      email: string;
      emails?:{value:string}[];
      displayName?:string
    };
  }
}
