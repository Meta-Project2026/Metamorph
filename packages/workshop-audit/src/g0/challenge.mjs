// Public challenge recipes; nonce values/observations stay in restricted evidence.
// Finite tests reject simple replay; they cannot prove absence of all hardcoding.
import { randomBytes } from "node:crypto";
import { check } from "./policy.mjs";

export async function challenge(driver, request) {
  const seen = new Set();
  const call = async (route, method, path, body) => {
    const x = await request(method, path, body);
    seen.add(`route-${route}`);
    return x;
  };
  if (driver === "items-v1") {
    const read = () => call("items-read", "GET", "/items");
    const initial = await read();
    check(
      Array.isArray(initial?.items) && initial.items.length === 0,
      "G0_CHALLENGE",
    );
    const values = [
      randomBytes(32).toString("hex"),
      randomBytes(32).toString("hex"),
    ];
    for (let i = 0; i < values.length; i++) {
      const written = await call(
        "items-write",
        "POST",
        "/items",
        JSON.stringify({ value: values[i] }),
      );
      const current = await read();
      for (const x of [written, current])
        check(
          x?.items?.length === i + 1 &&
            x.items.every(
              (row, n) => row.id === n + 1 && row.value === values[n],
            ),
          "G0_CHALLENGE",
        );
    }
  } else {
    check(driver === "workshop-v1", "G0_SCOPE");
    const read = () =>
      call("appointments", "GET", "/api.php?action=get_appointments");
    const form = (x) => new URLSearchParams(x).toString();
    check((await read())?.appointments?.length === 0, "G0_CHALLENGE");
    for (let round = 0; round < 2; round++) {
      const nonce = randomBytes(16).toString("hex");
      const day = 1 + (randomBytes(1)[0] % 20);
      const date = `2098-06-${String(day).padStart(2, "0")}`;
      const changedDate = `2098-07-${String(day).padStart(2, "0")}`;
      const slots = await call(
        "slots",
        "GET",
        `/api.php?action=get_slots&date=${date}`,
      );
      check(
        slots?.success === true &&
          slots.date === date &&
          Array.isArray(slots.mechanics) &&
          slots.mechanics.some((m) => m.id === 1 && m.available_slots > 0),
        "G0_CHALLENGE",
      );
      const input = {
        client_name: `G0${nonce}`,
        address: `A${nonce}`,
        phone: "+15551234567",
        car_license: `G0${nonce}`,
        car_engine: `E${nonce}`,
        appointment_date: date,
        mechanic_id: "1",
      };
      const written = await call(
        "book",
        "POST",
        "/api.php?action=book",
        form(input),
      );
      check(
        written?.success === true &&
          /^[1-9][0-9]*$/.test(String(written.appointment_id)),
        "G0_CHALLENGE",
      );
      const id = String(written.appointment_id);
      const rows = (await read())?.appointments;
      check(
        rows?.length === 1 &&
          String(rows[0].id) === id &&
          rows[0].client_name === input.client_name &&
          rows[0].car_license === input.car_license &&
          rows[0].appointment_date === date,
        "G0_CHALLENGE",
      );
      const updated = await call(
        "update",
        "POST",
        "/api.php?action=update_appointment",
        form({ id, appointment_date: changedDate, mechanic_id: "2" }),
      );
      const after = (await read())?.appointments;
      check(
        updated?.success === true &&
          after?.length === 1 &&
          String(after[0].id) === id &&
          after[0].appointment_date === changedDate &&
          String(after[0].mechanic_id) === "2" &&
          after[0].client_name === input.client_name,
        "G0_CHALLENGE",
      );
      const cancelled = await call(
        "cancel",
        "POST",
        "/api.php?action=cancel_appointment",
        form({ id }),
      );
      check(
        cancelled?.success === true &&
          (await read())?.appointments?.length === 0,
        "G0_CHALLENGE",
      );
    }
  }
  return [...seen];
}
