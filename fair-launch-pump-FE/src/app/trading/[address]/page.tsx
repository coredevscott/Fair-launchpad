"use client";
import { Chatting } from "@/components/Chatting";
import { CoinBlog } from "@/components/CoinBlog";
import { Holders } from "@/components/Holders";
import { TradeForm } from "@/components/TradeForm";
import { TradingChart } from "@/components/TVChart/TradingChart";
import UserContext from "@/context/UserContext";
import { coinInfo } from "@/utils/types";
import { getCoinInfo, getCoinTrade, getCoinsInfoBy, getSolPriceInUSD } from "@/utils/util";
import { usePathname, useRouter } from "next/navigation";
import { useContext, useEffect, useMemo, useState } from "react";

export default function Page() {
  const { coinId, setCoinId } = useContext(UserContext)
  const pathname = usePathname();
  const [param, setParam] = useState<string>('');
  const [progress, setProgress] = useState<Number>(60);
  const [coin, setCoin] = useState<coinInfo>({} as coinInfo);
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      // Split the pathname and extract the last segment
      const segments = pathname.split("/");
      const parameter = segments[segments.length - 1];
      setParam(parameter);
      setCoinId(parameter);
      const data = await getCoinInfo(parameter);
      const solPrice = await getSolPriceInUSD();
      const prog = data.reserveTwo * 1000000 * solPrice / (data.reserveOne * data.marketcap);
      setProgress(prog > 1? 100 : Math.round(prog * 100000)/1000);

      console.log("data: ", data, prog);
      setCoin(data);
    }
    fetchData()
  }, [pathname]);
  return (
    <>
      <div className="text-center">
        <div onClick={() => router.push('/')}>
          <h1 className="text-center text-xl font-normal hover:font-bold cursor-pointer py-4">
            [go back]
          </h1>
        </div>
      </div>
      <div className="grid grid-flow-col-dense grid-cols-3 m-auto px-3">
        {/* trading view chart  */}
        <div className=" col-span-2 mx-2">
          <TradingChart param={coin}></TradingChart>
          <Chatting param={param} coin={coin}></Chatting>
        </div>
        <div className="col-span-2">
          <TradeForm coin={coin} progress={progress}></TradeForm>
          <div className="flex m-5">
            <p className="text-2xl text-white hover:text-stone-900 px-3 cursor-pointer">
              [Twiter]
            </p>
            <p className="text-2xl text-white hover:text-stone-900 px-3 cursor-pointer">
              [Telegram]
            </p>
          </div>
          <div className="m-3 flex">
            <img
              src={coin.url}
              className="mr-5"
              alt="Token IMG"
              width={200}
              height={300}
            />
            <div className="mt-5 text-gray-400">
              <p className="text-2xl">Ticker: {coin.ticker}</p>
              <p>{coin.description}</p>
            </div>

          </div>
          <div className="">
            <p className="text-white text-2xl m-3.5">
              bonding curve progress: {progress.toString()}%
            </p>
            <div className="m-4 bg-slate-300 rounded-2xl h-[20px]  relative">
              <div
                className="bg-green-600 rounded-2xl h-[20px] "
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="mx-4 text-mg text-gray-300">
              when the market cap reaches $65,534 all the liquidity from the
              bonding curve will be deposited into Raydium and burned.
              progression increases as the price goes up.
            </p>
            <br></br>
            <p className="mx-4 text-lg text-gray-300">
              there are {coin.reserveOne} tokens still available for sale in the
              bonding curve and there is {coin.reserveTwo / 1000_000_000 - 30} SOL in the bonding curve.
            </p>
          </div>
          <div className="flex justify-between pt-4 m-4">
            <p className="text-2xl text-gray-300 leading-10">Holder distribution</p>
            <button className="p-2 bg-gray-600 rounded text-gray-400">Generate bubble map</button>
          </div>
          <Holders coin={coin}></Holders>

        </div>
      </div>
    </>
  );
}
