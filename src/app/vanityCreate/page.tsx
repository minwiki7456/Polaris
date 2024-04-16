"use client";

import {
    Button,
    TextField,
} from "@mui/material";
import {useCallback, useState} from "react";

import Log from "@/components/Log";
import useInterval from "@/hooks/useInterval";
import {handleLog} from "@/utils/helper";

const regexExample =
    '0x.*888$';

export default function Home() {
    const [running, setRunning] = useState<boolean>(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [successCount, setSuccessCount] = useState<number>(0);
    const [count, setCount] = useState<number>(1);
    const [threads, setThreads] = useState<number>(1);
    const [regex, setRegex] = useState<RegExp>(/0x.*/);

    const pushLog = useCallback((log: string, state?: string) => {
        setLogs((logs) => [
            handleLog(log, state),
            ...(logs.length >= 1000 ? logs.slice(0, 1000) : logs),
        ]);
    }, []);

    const run = useCallback(() => {
        if (threads <= 0) {
            pushLog("线程数非正整数", "error");
            setRunning(false);
            return;
        }
        if (count <= 0) {
            pushLog("生成钱包数量非正整数", "error");
            setRunning(false);
            return;
        }

        setRunning(true);
    }, [pushLog, threads, count]);

    return (
        <div className=" flex flex-col gap-4">

            <div className=" flex flex-col gap-2">
                <span>
                  钱包正则表达式:
                </span>
                <TextField
                    size="small"
                    placeholder={`钱包正则表达式，不填为随机钱包，例子：\n${regexExample}`}
                    disabled={running}
                    onChange={(e) => {
                        const text = e.target.value;
                        setRegex(new RegExp(text));
                    }}
                />
            </div>

            <div className=" flex flex-col gap-2">
                <span>线程数 (选填, 最低为1):</span>
                <TextField
                    type="number"
                    size="small"
                    placeholder="默认为1"
                    disabled={running}
                    onChange={(e) => {
                        const num = Number(e.target.value);
                        !Number.isNaN(num) && num > 0 && setThreads(num);
                    }}
                />
            </div>

            <div className=" flex flex-col gap-2">
                <span>生成的钱包数量 (选填, 最低为1):</span>
                <TextField
                    type="number"
                    size="small"
                    placeholder="默认为1"
                    disabled={running}
                    onChange={(e) => {
                        const num = Number(e.target.value);
                        !Number.isNaN(num) && num > 0 && setCount(num);
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
