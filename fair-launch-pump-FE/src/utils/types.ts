import { PublicKey } from "@solana/web3.js"

export type ChartTable = {
    table: {
        open: number;
        high: number;
        low: number;
        close: number;
        time: number;
    }[];
};

export type Chart = {
    time: number;
    opens: number[];
    highs: number[];
    lows: number[];
    closes: number[];
};


export interface userInfo {
    _id?: string,
    name: string,
    wallet: string,
    avatar?: string,
    isLedger?: Boolean,
    signature?: string,
}

export interface coinInfo {
    _id?: string,
    name: string,
    creator: string | userInfo,
    ticker: string,
    url: string,
    reserveOne: number,
    reserveTwo: number,
    token: string,
    marketcap?: number,
    presale?: number,
    replies?: number,
    description?: string,
    twitter?: string,
    date?: Date,
}
export interface msgInfo {
    coinId: string | coinInfo,
    sender: string | userInfo,
    time: Date,
    img?: string,
    msg: string,
}

export interface tradeInfo {
    creator: string | coinInfo,
    record: recordInfo[],

}

export interface holderInfo {
    slice: string;
    owner: string;
    amount: number
  }

export interface recordInfo {
    holder: userInfo,
    holdingStatus: number,
    time: Date,
    amount: number,
    tx: string,
}
export interface CharTable {
    table: {
        time: number;
        low: number;
        high: number;
        open: number;
        close: number;
        volume: number;
    }[];
}
export interface Bar {
    time: number;
    low: number;
    high: number;
    open: number;
    close: number;
    volume: number;
}
export interface replyInfo {
    coinId: string;
    sender: string;
    msg: string;
    img?: string;
}
export interface PeriodParamsInfo {
    from: number;
    to: number;
    countBack: number;
    firstDataRequest: boolean;
}