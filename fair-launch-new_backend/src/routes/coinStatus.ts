import CoinStatus from "../models/CoinsStatus";
import { ResultType } from "../program/web3";
import Coin from "../models/Coin";
import User from "../models/User";
import { UserInfo } from "./user";
import { fetchPriceChartData } from "../utils/chart";
import { io } from "../sockets";

export const setCoinStatus = async (data: ResultType) => {
  const coinId = await Coin.findOne({ token: data.mint }).select("_id");
  const userId = await User.findOne({ wallet: data.owner }).select("_id");
  try {
    const newTx = {
      holder: userId?._id,
      holdingStatus: data.swapType,
      amount: data.swapAmount,
      tx: data.tx,
      price: data.reserve2 / data.reserve1,
    };

    CoinStatus.findOne({ coinId: coinId?._id }).then((coinStatus) => {
      if (
        !(
          coinStatus?.record.findIndex((rec) => rec.tx === newTx.tx) &&
          coinStatus?.record.findIndex((rec) => rec.tx === newTx.tx) >= 0
        )
      ) {
        coinStatus?.record.push(newTx);
        coinStatus?.save();
      }
    });
    const updateCoin = await Coin.findOneAndUpdate(
      { token: data.mint },
      { reserveOne: data.reserve1, reserveTwo: data.reserve2 },
      { new: true }
    );

    if (io) {
      const cdFeeds = await fetchPriceChartData(1, data.mint, 300);
      io.emit("currentPrices", cdFeeds);
    }
  } catch (error) {
    console.log("Error:  ", error);
  }
};

export const getMCap = async (data: ResultType) => {
  const coin = await Coin.findOne({ token: data.mint }).populate("creator");
  const marketcap = coin?.marketcap;
  const date = coin?.date;
  const creator = (coin?.creator as unknown as UserInfo).wallet;

  return { creator, marketcap, date };
};
