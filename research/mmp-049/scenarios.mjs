// New independently authored PUBLIC regressions. No expectations from private audit.
const read = { method: "GET", path: "/api.php?action=get_appointments" };
const post = (action, form) => ({
  method: "POST",
  path: `/api.php?action=${action}`,
  body: new URLSearchParams(form).toString(),
});
const form = {
  client_name: "Public MMP049",
  address: "49 Public Compatibility Lane",
  phone: "+15550490001",
  car_license: "PUBLIC-049",
  car_engine: "ENGINE-049",
  appointment_date: "2099-09-19",
  mechanic_id: "1",
};
const booking = (overrides = {}) => post("book", { ...form, ...overrides });
const numeric = [
  ["missing-id", null],
  ["empty-id", ""],
  ["malformed-id", "nonnumeric"],
  ["prefix-id", "1tail"],
  ["exponent-tail-id", "1e1tail"],
  ["incomplete-exponent-id", "1e+"],
  ["fractional-id", "1.9"],
  ["fractional-exponent-id", "1e-1"],
  ["negative-id", "-1"],
  ["space-id", " 1 "],
  ["leading-nbsp-id", "\u00a01"],
  ["trailing-nbsp-id", "1\u00a0"],
  ["safe-integer-id", "9007199254740991"],
  ["unsafe-integer-id", "9007199254740993"],
  ["int-max-id", "9223372036854775807"],
  ["int-overflow-id", "9223372036854775808"],
  ["infinite-exponent-id", "1e309"],
];
export const regressions = [
  {
    id: "compat-decimal-lifecycle",
    requests: [
      booking(),
      post("update_appointment", {
        id: "1",
        appointment_date: "2099-09-20",
        mechanic_id: "2",
      }),
      post("cancel_appointment", { id: "1" }),
      read,
    ],
  },
  ...numeric.map(([id, value]) => {
    const fields = { ...form };
    if (value === null) delete fields.mechanic_id;
    else fields.mechanic_id = value;
    return { id: `compat-${id}`, requests: [post("book", fields), read] };
  }),
  {
    id: "compat-missing-cancel-id",
    requests: [booking(), post("cancel_appointment", {}), read],
  },
  {
    id: "compat-malformed-update-id",
    requests: [
      booking(),
      post("update_appointment", {
        id: "nonnumeric",
        appointment_date: "2099-09-20",
        mechanic_id: "2",
      }),
      read,
    ],
  },
  {
    id: "compat-space-update-id",
    requests: [
      booking(),
      post("update_appointment", {
        id: " 1 ",
        appointment_date: "2099-09-20",
        mechanic_id: "2",
      }),
      read,
    ],
  },
  {
    id: "compat-space-phone-engine",
    requests: [
      booking({ phone: " +1555 0490001 ", car_engine: " ENGINE 049 " }),
      read,
    ],
  },
  {
    id: "compat-edge-nbsp-phone",
    requests: [booking({ phone: "\u00a0+15550490001\u00a0" }), read],
  },
  {
    id: "compat-unicode-engine",
    requests: [booking({ car_engine: "ENGINE\u2003049" }), read],
  },
  {
    id: "compat-unicode-phone",
    requests: [booking({ phone: "+1555\ufeff0490001" }), read],
  },
];
