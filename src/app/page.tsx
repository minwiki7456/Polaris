"use client";

import {
  Button,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
} from "@mui/material";
import { useCallback, useState } from "react";
import {
  Chain,
  createWalletClient,
  Hex,
  http,
  isAddress,
  parseEther,
  SendTransactionErrorType,
  stringToHex,
  webSocket,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

import Log from "@/components/Log";
import { ChainKey, inscriptionChains } from "@/config/chains";
import useInterval from "@/hooks/useInterval";
import { handleAddress, handleLog } from "@/utils/helper";

const strExample =
  'data:,{"p":"bnb-48","op":"mint","tick":"fans","amt":"1"}';
const hexExample =
  '0x646174613a2c7b2270223a22626e622d3438222c226f70223a226d696e74222c227469636b223a2266616e73222c22616d74223a2231227d';

type TxRadioType = "meToMe" | "manyToOne";
type DataRadioType = "string" | "hex";

type GasRadio = "all" | "tip";

export default function Home() {
  const [chain, setChain] = useState<Chain>(mainnet);
  const [privateKeys, setPrivateKeys] = useState<Hex[]>([]);
  const [txRadio, setTxRadio] = useState<TxRadioType>("meToMe");
  const [toAddress, setToAddress] = useState<Hex>();
  const [rpc, setRpc] = useState<string>();
  const [dataRadio, setDataRadio] = useState<DataRadioType>("string");
  const [dataStr, setDataStr] = useState<string>("");
  const [dataHex, setDataHex] = useState<string>("");
  const [gas, setGas] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);
  const [delay, setDelay] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [gasRadio, setGasRadio] = useState<GasRadio>("tip");

  const pushLog = useCallback((log: string, state?: string) => {
    setLogs((logs) => [
      handleLog(log, state),
      ...(logs.length >= 1000 ? logs.slice(0, 1000) : logs),
    ]);
  }, []);

  const client = createWalletClient({
    chain,
    transport: rpc && rpc.startsWith("wss") ? webSocket(rpc) : http(rpc),
  });
  const accounts = privateKeys.map((key) => privateKeyToAccount(key));

  useInterval(
    async () => {
      const results = await Promise.allSettled(
        accounts.map((account) => {
          return client.sendTransaction({
            account,
            to: txRadio === "meToMe" ? account.address : toAddress,
            value: 0n,
              ...(dataRadio === "string" ?
                  {data: stringToHex(dataStr),} :
                  {data: dataHex as Hex}),
            ...(gas > 0
              ? gasRadio === "all"
                ? {
                    gasPrice: parseEther(gas.toString(), "gwei"),
                  }
                : {
                    maxPriorityFeePerGas: parseEther(gas.toString(), "gwei"),
                  }
              : {}),
          });
        }),
      );
      results.forEach((result, index) => {
        const address = handleAddress(accounts[index].address);
        if (result.status === "fulfilled") {
          pushLog(`${address} ${result.value}`, "success");
          setSuccessCount((count) => count + 1);
        }
        if (result.status === "rejected") {
          const e = result.reason as SendTransactionErrorType;
          let msg = `${e.name as string}: `;
          if (e.name === "TransactionExecutionError") {
            msg = msg + e.details;
          }
          if (e.name == "Error") {
            msg = msg + e.message;
          }
          pushLog(`${address} ${msg}`, "error");
        }
      });
    },
    running ? delay : null,
  );

  const run = useCallback(() => {
    if (privateKeys.length === 0) {
      pushLog("没有私钥", "error");
      setRunning(false);
      return;
    }

    if (txRadio === "manyToOne" && !toAddress) {
      pushLog("没有地址", "error");
      setRunning(false);
      return;
    }

    // if (!inscription) {
    //   setLogs((logs) => [handleLog("没有铭文", "error"), ...logs]);
    //   setRunning(false);
    //   return;
    // }

    setRunning(true);
  }, [privateKeys.length, pushLog, txRadio, toAddress]);

  return (
    <div className=" flex flex-col gap-4">
      <div className=" flex flex-col gap-2">
        <span>链:</span>
        <TextField
          select
          defaultValue="eth"
          size="small"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value as ChainKey;
            setChain(inscriptionChains[text]);
          }}
        >
          {Object.entries(inscriptionChains).map(([key, chain]) => (
            <MenuItem
              key={chain.id}
              value={key}
            >
              {chain.name}
            </MenuItem>
          ))}
        </TextField>
      </div>

      <div className=" flex flex-col gap-2">
        <span>私钥（必填，每行一个）:</span>
        <TextField
          multiline
          minRows={2}
          size="small"
          placeholder="私钥，带不带 0x 都行，程序会自动处理"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value;
            const lines = text.split("\n");
            const keys = lines
              .map((line) => {
                const key = line.trim();
                if (/^[a-fA-F0-9]{64}$/.test(key)) {
                  return `0x${key}`;
                }
                if (/^0x[a-fA-F0-9]{64}$/.test(key)) {
                  return key as Hex;
                }
              })
              .filter((x) => x) as Hex[];
            setPrivateKeys(keys);
          }}
        />
      </div>

      <RadioGroup
        row
        defaultValue="meToMe"
        onChange={(e) => {
          const value = e.target.value as TxRadioType;
          setTxRadio(value);
        }}
      >
        <FormControlLabel
          value="meToMe"
          control={<Radio />}
          label="自转(每个钱包向自己转账)"
          disabled={running}
        />
        <FormControlLabel
          value="manyToOne"
          control={<Radio />}
          label="多转一(每个钱包向单独一个地址转账)"
          disabled={running}
        />
      </RadioGroup>

      {txRadio === "manyToOne" && (
        <div className=" flex flex-col gap-2">
          <span>转给谁的地址（必填）:</span>
          <TextField
            size="small"
            placeholder="地址"
            disabled={running}
            onChange={(e) => {
              const text = e.target.value;
              isAddress(text) && setToAddress(text);
            }}
          />
        </div>
      )}

        <RadioGroup
            row
            defaultValue="string"
            onChange={(e) => {
                const value = e.target.value as DataRadioType;
                setDataRadio(value);
            }}
        >
            <FormControlLabel
                value="string"
                control={<Radio />}
                label="字符串"
                disabled={running}
            />
            <FormControlLabel
                value="hex"
                control={<Radio />}
                label="16进制"
                disabled={running}
            />
        </RadioGroup>

        {dataRadio === "string" ?
            (<div className=" flex flex-col gap-2">
                <span>字符串（选填）:</span>
                <TextField
                  size="small"
                  placeholder={`字符串，注意中英文、全角半角和空格，例子：\n${strExample}`}
                  disabled={running}
                  onChange={(e) => {
                    const text = e.target.value;
                    setDataStr(text.trim());
                  }}
                />
              </div>):
            (<div className=" flex flex-col gap-2">
                <span>十六进制Hex（选填）:</span>
                <TextField
                    size="small"
                    placeholder={`十六进制Hex，例子：\n${hexExample}`}
                    disabled={running}
                    onChange={(e) => {
                        const text = e.target.value;
                        setDataHex(text);
                    }}
                />
            </div>)}

      <div className=" flex flex-col gap-2">
        <span>
          RPC (选填, 默认公共有瓶颈经常失败, 最好用付费的, http 或者 ws 都可以):
        </span>
        <TextField
          size="small"
          placeholder="RPC"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value;
            setRpc(text);
          }}
        />
      </div>

      <RadioGroup
        row
        defaultValue="tip"
        onChange={(e) => {
          const value = e.target.value as GasRadio;
          setGasRadio(value);
        }}
      >
        <FormControlLabel
          value="tip"
          control={<Radio />}
          label="额外矿工小费"
          disabled={running}
        />
        <FormControlLabel
          value="all"
          control={<Radio />}
          label="总 gas"
          disabled={running}
        />
      </RadioGroup>

      <div className=" flex flex-col gap-2">
        <span>{gasRadio === "tip" ? "额外矿工小费" : "总 gas"} (选填):</span>
        <TextField
          type="number"
          size="small"
          placeholder={`${
            gasRadio === "tip" ? "默认 0" : "默认最新"
          }, 单位 gwei，例子: 10`}
          disabled={running}
          onChange={(e) => {
            const num = Number(e.target.value);
            !Number.isNaN(num) && num >= 0 && setGas(num);
          }}
        />
      </div>

      <div className=" flex flex-col gap-2">
        <span>每笔交易间隔时间 (选填, 最低 0 ms):</span>
        <TextField
          type="number"
          size="small"
          placeholder="默认 0 ms"
          disabled={running}
          onChange={(e) => {
            const num = Number(e.target.value);
            !Number.isNaN(num) && num >= 0 && setDelay(num);
          }}
        />
      </div>

      <Button
        variant="contained"
        color={running ? "error" : "success"}
        onClick={() => {
          if (!running) {
            run();
          } else {
            setRunning(false);
          }
        }}
      >
        {running ? "运行中" : "运行"}
      </Button>

      <Log
        title={`日志（成功次数 => ${successCount}）:`}
        logs={logs}
        onClear={() => {
          setLogs([]);
        }}
      />
    </div>
  );
}
