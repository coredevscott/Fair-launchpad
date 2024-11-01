"use client";

import { Spinner } from "@/components/Spinner";
import { errorAlert, infoAlert } from "@/components/ToastGroup";
import UserContext from "@/context/UserContext";
import { useSocket } from "@/contexts/SocketContext";
import { creatFeePay } from "@/program/web3";
import { coinInfo } from "@/utils/types";
import { createNewCoin, uploadImage } from "@/utils/util";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  useContext,
  useEffect,
  useState,
} from "react";

export default function CreateCoin() {
  const { user, imageUrl, setImageUrl, isCreated, setIsCreated } =
    useContext(UserContext);
  const { isLoading, setIsLoading, alertState } = useSocket();
  const [newCoin, setNewCoin] = useState<coinInfo>({} as coinInfo);
  const [isCreate, setIsCreate] = useState(false);
  const [visible, setVisible] = useState<Boolean>(false);
  const [getAmt, setGetAmt] = useState<number>(0);
  const [selectedFileName, setSelectedFileName] = useState("");
  const wallet = useWallet();
  const router = useRouter();

  const handleToRouter = (id: string) => {
    router.push(id)
  }

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setNewCoin({ ...newCoin, [e.target.id]: e.target.value });
  };

  const handlePresaleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (Number(e.target.value) > 1.5) console.log("Exceed Amount");
    else if (isNaN(Number(e.target.value)) || Number(e.target.value) === 0) setNewCoin({ ...newCoin, [e.target.id]: undefined });
    else {
      const getAmount = 1_000_000_000 - 30*1_000_000_000/(30+Number(e.target.value)*99/100);
      console.log(getAmount)
      setGetAmt(getAmount);
      setNewCoin({ ...newCoin, [e.target.id]: Number(e.target.value) });
    }
  };
  console.log("typeof presale---->", newCoin.presale)

  const handleMcapChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (Number(e.target.value) > 100000) console.log("Exceed Amount");
    else if (isNaN(Number(e.target.value)) || Number(e.target.value) === 0) setNewCoin({ ...newCoin, [e.target.id]: undefined });
    else {
      setNewCoin({ ...newCoin, [e.target.id]: Number(e.target.value) });
    }
  };

  const createCoin = async () => {
    let coin: coinInfo;

    if (!(newCoin.marketcap && (newCoin.marketcap <= 10000 || newCoin.marketcap >= 5000))) {
      errorAlert("Should Input Marketcap in range of 5K ~ 10K")
      return
    }
    if (newCoin.name === undefined) {
      errorAlert("Should Input the name of Memecoin")
      return
    }
    if (newCoin.ticker === undefined) {
      errorAlert("Should Input the ticker of Memecoin")
      return
    }
    if (newCoin.presale === undefined) {
      setNewCoin({ ...newCoin, presale: 0 });
    }
    if (imageUrl && imageUrl !== "/*.png") {
      setIsLoading(true);
      const res = await creatFeePay(wallet, newCoin.presale);

      if (res === "WalletError") {
        errorAlert("Wallet Not Connected")
        setIsLoading(false)
        return
      } else if (res === "RejectSolPay") {
        errorAlert("Rejected SOL Payment");
        setIsLoading(false)
        return
      } else if (res === "NotEnoughBalance") {
        errorAlert("Not enough SOL balance to create coin.");
        setIsLoading(false)
        return
      }
      
      const url = await uploadImage(imageUrl);
      infoAlert(`Uploaded Image for ${newCoin.name}`)
      if (url && user._id) {
        coin = {
          ...newCoin,
          creator: user._id.toString(),
          url: url,
        };
        const created = await createNewCoin(coin);
        setIsCreated(created);
        setNewCoin({} as coinInfo);
      }
    } else {
      errorAlert("Should select the image of Memecoin")
      console.error("Image URL is not defined");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      setSelectedFileName(file.name);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
    }
  };
  return (
    <div className=" w-[500px] m-auto ">
      <div onClick={() => handleToRouter('/')}>
        <h1 className=" text-center font-normal hover:font-bold m-auto  cursor-pointer ">
          [go back]
        </h1>
      </div>
      {isLoading && Spinner()}
      <div className=" pt-[20px] m-auto">
        <label
          htmlFor="name  py-[20px]"
          className="block mb-2 text-sm font-medium text-white"
        >
          name*
        </label>
        <input
          type="text"
          id="name"
          value={newCoin.name ?? ""}
          onChange={handleChange}
          className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="name"
          required
        />
      </div>
      <div className="pt-[20px] m-auto">
        <label
          htmlFor="ticker py-[20px]"
          className="block mb-2 text-sm font-medium text-white"
        >
          ticker*
        </label>
        <input
          type="text"
          id="ticker"
          value={newCoin.ticker ?? ""}
          onChange={handleChange}
          className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="ticker"
          required
        />
      </div>
      <div className="pt-[20px] m-auto">
        <label
          htmlFor="mcap py-[20px]"
          className="block mb-2 text-sm font-medium text-white"
        >
          marketcap
        </label>
        <input
          type="number"
          id="marketcap"
          onChange={handleMcapChange}
          value={newCoin.marketcap}
          className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="5000 ~ 10000"
        />
      </div>
      <div className="pt-[20px] m-auto">
        <label
          htmlFor="presale py-[20px]"
          className="block mb-2 text-sm font-medium text-white"
        >
          How much do you want to buy (optional) <br/>
          <span className="text-blue-400 text-xs">
            You will only get these token when the target marketcap has been reached and the Raydium LP has  been created.
          </span>
        </label>
        <div className="flex flex-row w-full justify-end ">
        <span className="mr-12"> You Will Get:  </span> {getAmt.toFixed(2)}&nbsp;{newCoin.ticker}
        </div>
        <input
          type="number"
          id="presale"
          onChange={handlePresaleChange}
          value={newCoin.presale}
          className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="0 ~ 1.5 SOL"
        />
      </div>
      <div className=" pt-[20px] m-auto">
        <label
          htmlFor="description  py-[20px]"
          className="block mb-2 text-sm font-medium text-white"
        >
          description
        </label>
        <textarea
          id="description"
          value={newCoin.description ?? ""}
          onChange={handleChange}
          className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="description"
          required
        />
      </div>
      <div className="mt-[20px] m-auto bg-white pt-2 rounded-lg text-black">
        <input
          type="file"
          className="ml-2 mb-2"
          onChange={handleFileChange}
          multiple
        />
      </div>
      <div className="font-xl m-auto mt-5 w-24 ">
        <h1
          className="hover:text-gray-400 cursor-pointer text-white"
          onClick={() => setVisible(!visible)}
        >
          more option
        </h1>
      </div>
      {visible && (
        <>
          <div className=" m-auto">
            <label
              htmlFor="twitter py-[20px]"
              className="block mb-2 text-sm font-medium text-white"
            >
              Twitter
            </label>
            <input
              type="text"
              id="twitter"
              value={newCoin.twitter}
              onChange={handleChange}
              className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              placeholder="Optional"
              required
            />
          </div>
        </>
      )}
      <div>
        <button
          className=" mt-[20px] active:bg-slate-900 m-auto rounded-lg bg-blue-700 hover: text-center py-2 w-full"
          onClick={createCoin}
          disabled={isCreate}
        >
          create coin
        </button>
      </div>
    </div>
  );
}
