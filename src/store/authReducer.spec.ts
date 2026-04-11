import { expect } from "chai";
import { authReducer } from "./authReducer";
import { AUTH_LOGIN_SUCCESS, AUTH_LOGOUT, AUTH_REGISTER_DONE } from "./actionTypes";

describe("authReducer", () => {
  it("stores session on login success", () => {
    const next = authReducer(undefined, {
      type: AUTH_LOGIN_SUCCESS,
      payload: { accessToken: "t", user: { id: "u1", email: "a@b.c" } },
    });
    expect(next.accessToken).to.equal("t");
    expect(next.user?.id).to.equal("u1");
  });

  it("clears on logout", () => {
    const logged = authReducer(undefined, {
      type: AUTH_LOGIN_SUCCESS,
      payload: { accessToken: "t", user: { id: "u1" } },
    });
    const cleared = authReducer(logged, { type: AUTH_LOGOUT });
    expect(cleared.accessToken).to.equal(null);
  });

  it("splits register success and error", () => {
    const ok = authReducer(undefined, {
      type: AUTH_REGISTER_DONE,
      payload: { ok: true, message: "Done" },
    });
    expect(ok.registerSuccess).to.equal("Done");
    expect(ok.registerError).to.equal(null);
    const bad = authReducer(undefined, {
      type: AUTH_REGISTER_DONE,
      payload: { ok: false, message: "No" },
    });
    expect(bad.registerError).to.equal("No");
    expect(bad.registerSuccess).to.equal(null);
  });
});
