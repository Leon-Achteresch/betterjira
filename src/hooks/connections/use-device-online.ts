import { useSyncExternalStore } from "react";
import { deviceOnline, deviceOnlineOnServer, subscribeDeviceNetwork } from "@/lib/connections/device-network";

export const useDeviceOnline = () => useSyncExternalStore(subscribeDeviceNetwork, deviceOnline, deviceOnlineOnServer);
