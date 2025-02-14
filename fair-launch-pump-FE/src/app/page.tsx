"use client";

import Header from "@/components/Header";
import { CoinBlog } from "@/components/CoinBlog";
import { getCoinsInfo, getSolPriceInUSD, test } from "@/utils/util";
import Image from "next/image";
import { useContext, useEffect, useRef, useState } from "react";
import UserContext from "@/context/UserContext";
import { coinInfo } from "@/utils/types";
import { useRouter } from "next/navigation";

export default function Home() {
  const { isLoading, setIsLoading, isCreated, solPrice, setSolPrice } = useContext(UserContext);
  const [totalStaked, setTotalStaked] = useState(0);
  const [token, setToken] = useState("");
  const [data, setData] = useState<coinInfo[]>([]);
  const [dataSort, setDataSort] = useState<string>("dump order");
  const [isSort, setIsSort] = useState(0);
  const [order, setOrder] = useState("desc")
  const [king, setKing] = useState<coinInfo>({} as coinInfo);
  const dropdownRef = useRef(null);
  const dropdownRef1 = useRef(null);
  const router = useRouter()

  const handleToRouter = (id: string) => {
    router.push(id)
  }

  useEffect(() => {
    const fetchData = async () => {
      const coins = await getCoinsInfo();
      const price = await getSolPriceInUSD();
      if (coins !== null) {
        coins.sort((a, b) => a.reserveOne - b.reserveOne);

        setData(coins);
        setIsLoading(true);
        setKing(coins[0]);
        setSolPrice(price);
      }
    };
    fetchData();

  }, []);
  const handleSortSelection = (option) => {
    let sortOption: string = '';
    let orderOption: string = "";
    let sortedData = [...data]; // Create a new array to prevent direct state mutation
    if (option == "desc" || option == "asc") {
      setOrder(option);
      sortOption = dataSort;
      orderOption = option;
    }
    else {
      setDataSort(option)
      sortOption = option
      orderOption = order;
    }
    if (orderOption == "desc") {
      switch (sortOption) {
        case "bump order":
          sortedData.sort((a, b) => a.reserveOne - b.reserveOne);
          break;
        case "last reply":
          sortedData.sort((a, b) => a.reserveOne - b.reserveOne);
          break;
        case "reply count":
          sortedData.sort((a, b) => a.reserveOne - b.reserveOne);
          break;
        case "market cap":
          sortedData.sort((a, b) => a.reserveOne - b.reserveOne);
          break;
        case "creation time":
          sortedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          break;
        default:
          sortedData = data;
          break;
      }
    } else {
      switch (sortOption) {
        case "bump order":
          sortedData.sort((a, b) => b.reserveOne - a.reserveOne);
          break;
        case "last reply":
          sortedData.sort((a, b) => b.reserveOne - a.reserveOne);
          break;
        case "reply count":
          sortedData.sort((a, b) => b.reserveOne - a.reserveOne);
          break;
        case "market cap":
          sortedData.sort((a, b) => b.reserveOne - a.reserveOne);
          break;
        case "creation time":
          sortedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          break;
        default:
          sortedData = data;
          break;
      }
    }
    setData(sortedData);
    setIsSort(0); // Close the dropdown after selection
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        dropdownRef1.current && !dropdownRef1.current.contains(event.target)
      ) {
        setIsSort(0);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef, dropdownRef1]);
  const searchToken = () => { };
  return (
    <main className="min-h-screen flex-col  justify-between p-24 pt-2 ">
      <div onClick={() => handleToRouter('/create-coin')} className="text-center w-[240px]  m-auto">
        <h2 className="text-cener text-2xl font-medium hover:font-bold cursor-pointer">
          Start a New Coin
        </h2>
      </div>
      <div className="flex-col content-between">
        <h1 className="text-xl font-bold py-4 text-center">King of the hill</h1>
        <div className="flex justify-center">
          {data[0] && (
            <div onClick={() => handleToRouter(`/trading/${data[0]?._id}`)} className="cursor-pointer">
              <CoinBlog coin={data[0]} componentKey="king" />
            </div>
          )}
        </div>
      </div>
      <div className="flex mt-10 justify-center pb-4 text-black">
        <input
          type="text"
          value={token}
          placeholder=" Search for Token"
          onChange={(e) => setToken(e.target.value)}
          className=" bg-grey-400 h-[40px] w-[400px]"
        />
        <button
          className="w-[70px] h-[40px] mx-5 bg-slate-800 active:bg-opacity-70 "
          onClick={searchToken}
        >
          Search
        </button>
      </div>
      <div className="flex">
        <div ref={dropdownRef} className="mx-4">
          <button className="bg-green-600 w-[200px] h-[50px] font-medium rounded-md " onClick={() => setIsSort(1)}>
            SORT: {dataSort}
          </button>
          {(isSort == 1) &&
            <div className="bg-green-400 text-center rounded-sm my-1 absolute w-[200px] text-lg top-64">
              <p onClick={() => handleSortSelection("bump order")} className="hover:bg-green-200 cursor-pointer">
                Sort: bump order
              </p>
              <p onClick={() => handleSortSelection("last reply")} className="hover:bg-green-200 cursor-pointer">
                Sort: last reply
              </p>
              <p onClick={() => handleSortSelection("reply count")} className="hover:bg-green-200 cursor-pointer">
                Sort: reply count
              </p>
              <p onClick={() => handleSortSelection("market cap")} className="hover:bg-green-200 cursor-pointer">
                Sort: market cap
              </p>
              <p onClick={() => handleSortSelection("creation time")} className="hover:bg-green-200 cursor-pointer">
                Sort: creation time
              </p>
            </div>
          }
        </div>
        <div ref={dropdownRef1}>
          <button className="bg-green-600 w-[200px] h-[50px] font-medium rounded-md " onClick={() => setIsSort(2)}>
            Order: {order}
          </button>
          {(isSort == 2) &&
            <div className="bg-green-400 text-center rounded-md my-1 absolute w-[200px] text-lg top-[340px]">
              <p onClick={() => handleSortSelection("desc")} className="hover:bg-green-200 cursor-pointer">Sort:Desc</p>
              <p onClick={() => handleSortSelection("asc")} className="hover:bg-green-200 cursor-pointer">Sort:asc</p>
            </div>
          }
        </div>
      </div>
      {data && (
        <div className="flex-wrap flex justify-center ">
          {data.map((temp, index) => (
            <div key={index} onClick={() => handleToRouter(`/trading/${temp._id}`)} className="cursor-pointer">
              <CoinBlog coin={temp} componentKey="coin"></CoinBlog>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
