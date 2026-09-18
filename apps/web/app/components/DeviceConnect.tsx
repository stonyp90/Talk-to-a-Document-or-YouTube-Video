"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../i18n/LanguageProvider";
import { useHydrated } from "./useHydrated";

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
  const [device, setDevice] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const bluetoothAvailable =
    hydrated &&
    typeof navigator !== "undefined" &&
    Boolean((navigator as BluetoothNavigator).bluetooth);

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
      setDevice(selected.name || t("Bluetooth device"));
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
      setDevice(url.hostname);
      setStatus(t("Internet device connected."));
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
        <span>{t("Bluetooth or internet")}</span>
      </summary>
      <div className="device-connect-body">
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
        {device && (
          <p className="device-connect-status" role="status">
            <span className="status" data-state="ready" />
            {device} · {status}
          </p>
        )}
        {!device && status && (
          <p className="device-connect-status" role="status">
            {status}
          </p>
        )}
      </div>
    </details>
  );
}
