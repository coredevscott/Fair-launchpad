"use client";

import { FC, useContext, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import { successAlert, errorAlert, infoAlert } from "@/components/ToastGroup";
import base58 from "bs58";
import UserContext from "@/context/UserContext";
import { confirmWallet, walletConnect } from "@/utils/util";
import { userInfo } from "@/utils/types";
import { useRouter } from "next/navigation";

export const ConnectButton: FC = () => {
  const { user, setUser, login, setLogin, isLoading, setIsLoading } =
    useContext(UserContext);
  const { publicKey, disconnect, connect, signMessage } = useWallet();
  const { visible, setVisible } = useWalletModal();
  const router = useRouter()

  const tempUser = useMemo(() => user, [user]);
  useEffect(() => {
    const handleClick = async () => {
      if (publicKey && !login) {
        const updatedUser: userInfo = {
          name: publicKey.toBase58().slice(0, 6),
          wallet: publicKey.toBase58(),
          isLedger: false,
        };
        await sign(updatedUser);
      }
    };
    handleClick();
  }, [publicKey, login]); // Removed `connect`, `wallet`, and `disconnect` to prevent unnecessary calls
  const sign = async (updatedUser: userInfo) => {
    try {
      const connection = await walletConnect({ data: updatedUser });
      if(!connection) return;
      if (connection.nonce===undefined) {
        const newUser = {
          name: connection.name,
          wallet: connection.wallet,
          _id: connection._id,
          avatar: connection.avatar,
        };
        setUser(newUser as userInfo);
        setLogin(true);
        return;
      }

      const msg = new TextEncoder().encode(
        `Nonce to confirm: ${connection.nonce}`
      );
      
      const sig = await signMessage?.(msg);
      const res = base58.encode(sig as Uint8Array);
      const signedWallet = { ...connection, signature: res };
      const confirm = await confirmWallet({ data: signedWallet });

      if (confirm) {
        setUser(confirm);
        setLogin(true);
        setIsLoading(false);
      }
      successAlert("Message signed.");
    } catch (error) {
      errorAlert("Sign-in failed.");
    }
  };

  const logOut = async () => {
    if (typeof disconnect === "function") {
      await disconnect();
    }
    // Initialize `user` state to default value
    setUser({} as userInfo);
    setLogin(false);
    localStorage.clear();
  };
  const handleToProfile = (id: string) => {
    router.push(id)
  }
  return (
    <div>
      <button className=" rounded-lg border-[0.75px] border-[#371111] bg-[#5b1717] shadow-btn-inner text-[#ffffff] tracking-[0.32px] h-[42px] px-2 group relative ">
        {login  && publicKey ? (
          <>
            <div className="flex mr-3 items-center justify-center text-[16px] lg:text-md">
             {(user.avatar !== undefined) && <img
                src={user.avatar}
                alt="Token IMG"
                className="rounded p-1"
                width={35}
                height={35}
              />}
              <div className="ml-3">
                {publicKey.toBase58().slice(0, 4)}....
                {publicKey.toBase58().slice(-4)}
              </div>
            </div>
            <div className="w-[200px] absolute right-0 top-10 hidden group-hover:block">
              <ul className="border-[0.75px] border-[#371111] rounded-lg bg-[#371111] p-2 ">
                <li>
                  <div
                    className="flex gap-2 items-center mb-1 text-primary-100 text-md tracking-[-0.32px]"
                    onClick={() => setVisible(true)}
                  >
                    Change Wallet
                  </div>
                </li>
                <li>
                  <div
                    className="flex gap-2 items-center text-primary-100 text-md tracking-[-0.32px]"
                    onClick={logOut}
                  >
                    Disconnect
                  </div>
                </li>
              </ul>
            </div>
          </>
        ) : (
          <div
            className="flex items-center justify-center gap-1 text-md"
            onClick={() => setVisible(true)}
          >
            Connect wallet
          </div>
        )}
      </button>
      <div>
        {login && tempUser.wallet && (
            <div onClick={() => handleToProfile(`/profile/${tempUser._id}`)} className="text-center py-1 text-md text-white cursor-pointer hover:bg-slate-800 hover:rounded-md active:bg-violet-700 focus:outline-none focus:ring focus:ring-violet-300">
              [View Profile]
            </div>
        )}
      </div>
    </div>
  );
};
