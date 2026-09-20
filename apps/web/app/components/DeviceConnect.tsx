"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../i18n/LanguageProvider";
import { useHydrated } from "./useHydrated";

type ConnectedDevice = {
  id: string;
  name: string;
  kind: "bluetooth" | "internet";
};

type BluetoothDevice = {
  name?: string;
  gatt?: { connect: () => Promise<unknown> };
};

type BluetoothNavigator = Navigator & {
  bluetooth?: {
    requestDevice: (options: {
      acceptAllDevices: boolean;
      optionalServices?: string[];
    }) => Promise<BluetoothDevice>;
  };
};

export function DeviceConnect() {
  const { t } = useLanguage();
  const hydrated = useHydrated();
  const [endpoint, setEndpoint] = useState("");
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const bluetoothAvailable =
    hydrated &&
    typeof navigator !== "undefined" &&
    Boolean((navigator as BluetoothNavigator).bluetooth);

  function addDevice(name: string, kind: "bluetooth" | "internet") {
    setDevices((current) => {
      if (current.some((device) => device.name === name && device.kind === kind))
        return current;
      return [...current, { id: `${kind}-${Date.now()}`, name, kind }];
    });
  }

  function removeDevice(id: string) {
    setDevices((current) => current.filter((device) => device.id !== id));
  }

  async function connectBluetooth() {
    const bluetooth = (navigator as BluetoothNavigator).bluetooth;
    if (!bluetooth) return;
    setBusy(true);
    setStatus("");
    try {
      const selected = await bluetooth.requestDevice({
        acceptAllDevices: true,
      });
      await selected.gatt?.connect();
      const name = selected.name || t("Bluetooth device");
      addDevice(name, "bluetooth");
      setStatus(t("Bluetooth device connected."));
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        setStatus(t("No device selected."));
      } else {
        setStatus(t("Bluetooth connection was not completed."));
      }
    } finally {
      setBusy(false);
    }
  }

  async function connectInternet(event: FormEvent) {
    event.preventDefault();
    let url: URL;
    try {
      url = new URL(endpoint);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      setStatus(t("Enter a valid http or https device address."));
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json, text/plain" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error();
      addDevice(url.hostname, "internet");
      setStatus(t("Internet device connected."));
      setEndpoint("");
    } catch {
      setStatus(
        t(
          "The device did not respond. Check its address and allow browser access.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="device-connect">
      <summary>
        <Icon name="external" /> {t("Connect a device")}
        <span>
          {t("Bluetooth or internet")}
          {devices.length > 0 && ` · ${devices.length}`}
        </span>
      </summary>
      <div className="device-connect-body">
        {devices.length > 0 && (
          <div className="device-list">
            {devices.map((device) => (
              <div key={device.id} className="device-list-item">
                <div className="device-list-info">
                  <span className="device-list-dot" data-kind={device.kind} />
                  <span className="device-list-name">{device.name}</span>
                  <span className="device-list-kind">
                    {device.kind === "bluetooth" ? t("Bluetooth") : t("Internet")}
                  </span>
                </div>
                <button
                  type="button"
                  className="device-list-remove"
                  onClick={() => removeDevice(device.id)}
                  aria-label={t("Disconnect {name}", { name: device.name })}
                >
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="hint">
          {t(
            "Connect a nearby device over Bluetooth, or enter the secure address of a device on your network. Ursly only checks the endpoint you choose.",
          )}
        </p>
        <div className="device-connect-options">
          <button
            type="button"
            className="secondary"
            onClick={() => void connectBluetooth()}
            disabled={busy || !bluetoothAvailable}
          >
            <Icon name="motion" />{" "}
            {bluetoothAvailable
              ? t("Find Bluetooth device")
              : t("Bluetooth unavailable")}
          </button>
          <form onSubmit={connectInternet} className="device-internet-form">
            <label htmlFor="device-endpoint">{t("Device address")}</label>
            <div>
              <input
                id="device-endpoint"
                type="url"
                inputMode="url"
                placeholder="https://device.local/health"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
              />
              <button type="submit" className="secondary" disabled={busy}>
                {t("Connect")}
              </button>
            </div>
          </form>
        </div>
        {status && (
          <p className="device-connect-status" role="status">
            {status}
          </p>
        )}
      </div>
    </details>
  );
}
