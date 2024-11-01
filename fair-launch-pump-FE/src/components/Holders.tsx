import { coinInfo, holderInfo, recordInfo, tradeInfo, userInfo } from "@/utils/types";
import { findHolders, getCoinTrade } from "@/utils/util";
import { set } from "@coral-xyz/anchor/dist/cjs/utils/features";
import { useEffect, useState } from "react";

interface HolderInfo {
  coin: coinInfo;
}
// interface holderInfo {
//   holder: userInfo;
//   totalAmount: number
// }

export const Holders: React.FC<HolderInfo> = ({ coin }) => {
  const [trades, setTrades] = useState<tradeInfo>({} as tradeInfo);
  const [holders, setHolders] = useState<holderInfo[]>([])
  useEffect(() => {
    const fetchData = async () => {
        // const data: tradeInfo = await getCoinTrade(param);
        // setTrades(data)
        // const agr=holderCalc(data.record);
        // setHolders(agr);
      if (coin) {
        console.log(coin, "===========");
        const holderData = await findHolders(coin.token);
        setHolders(holderData ? holderData : []);
      }
    }
    fetchData();
  }, [coin])
  
  // const holderCalc = (records: recordInfo[]): holderInfo[] => {
  //   const aggregation = records.reduce((acc, record) => {
  //     const { holder, amount } = record;

  //     if (!acc[holder.name]) {
  //       acc[holder.name] = {
  //         holder,
  //         totalAmount: 0,
  //       };
  //     }
  //     acc[holder.name].totalAmount += (-1)**(record.holdingStatus)*amount;
  //     return acc;
  //   }, {} as Record<string, holderInfo>);

  //   return Object.values(aggregation);
  // };

  return (
    <div className="m-4">
      {holders && holders.map((trade, index) => (
        <div key={index} className="flex justify-between text-xl text-white">
          <div>
            {index + 1}. {trade.slice}
          </div>
          <div>{Math.floor(trade.amount/10_000_000_000)/1000}%</div>
        </div>
      ))}
    </div>
  );
};
