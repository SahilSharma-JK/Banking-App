import { useState } from "react";

import {
  User,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Accounts from "./pages/Accounts";
import Transactions from "./pages/Transactions";
import ToastHost from "./components/Toast";

import "./App.css";


// ============================================================
// LOGIN PAGE
// ============================================================

function LoginPage() {

  const [showPassword, setShowPassword] =
    useState(false);

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  const navigate =
    useNavigate();


  // ============================================================
  // HANDLE LOGIN
  // ============================================================

  const handleLogin = async (e) => {

    e.preventDefault();

    setError("");
    setLoading(true);


    try {

      const response =
        await fetch(
          "http://localhost:5000/api/auth/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              username,
              password,
            }),
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.message ||
          "Login failed"
        );
      }


      // ====================================================
      // STORE JWT TOKEN
      // ====================================================

      localStorage.setItem(
        "token",
        result.data.token
      );

      if (result.data.admin) {
        localStorage.setItem(
          "admin",
          JSON.stringify(result.data.admin)
        );
      }


      console.log(
        "Login successful:",
        result
      );


      // ====================================================
      // VERIFY JWT
      // ====================================================

      const token =
        result.data.token;


      const verifyResponse =
        await fetch(
          "http://localhost:5000/api/auth/me",
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );


      const verifyResult =
        await verifyResponse.json();


      console.log(
        "JWT verification:",
        verifyResult
      );


      if (
        verifyResult.success
      ) {

        const defaultPage =
          localStorage.getItem(
            "zenbank_default_page"
          ) || "/dashboard";

        navigate(
          defaultPage
        );

      }

    } catch (error) {

      setError(
        error.message
      );

    } finally {

      setLoading(false);
    }
  };


  // ============================================================
  // LOGIN UI
  // ============================================================

  return (

    <main className="login-page">

      <div className="glow glow-one"></div>

      <div className="glow glow-two"></div>

      <div className="grid-pattern"></div>


      <section className="login-container">


        {/* ==================================================
                    BRAND PANEL
                ================================================== */}

        <div className="brand-panel">

          <div className="brand-content">


            <div className="brand-name">

              <span>
                ZEN
              </span>

              <em>
                bank
              </em>

            </div>


            <p className="brand-tagline">
              Modern Banking, Simplified.
            </p>


            <div className="hero-content">

              <div className="mini-badge">
                ✦ SMART BANKING PLATFORM
              </div>


              <h1>
                Banking that

                <span>
                  {" "}moves with you.
                </span>
              </h1>


              <p>
                Manage customers, accounts and transactions
                from one secure and intelligent banking platform.
              </p>

            </div>


            <div className="feature-row">


              <div className="feature">

                <div className="feature-icon">
                  ↗
                </div>

                <div>

                  <strong>
                    Secure
                  </strong>

                  <small>
                    Protected access
                  </small>

                </div>

              </div>


              <div className="feature">

                <div className="feature-icon">
                  ◈
                </div>

                <div>

                  <strong>
                    Powerful
                  </strong>

                  <small>
                    Built for banking
                  </small>

                </div>

              </div>

            </div>

          </div>


          <div className="brand-footer">

            <span>
              ZENbank Banking System
            </span>

            <span>
              •
            </span>

            <span>
              Secure & Reliable
            </span>

          </div>

        </div>


        {/* ==================================================
                    LOGIN PANEL
                ================================================== */}

        <div className="form-panel">


          <div className="mobile-brand">

            <div className="brand-name">

              <span>
                ZEN
              </span>

              <em>
                bank
              </em>

            </div>

            <p>
              Modern Banking, Simplified.
            </p>

          </div>


          <div className="form-header">

            <div className="welcome-icon">
              👋
            </div>


            <div>

              <p className="eyebrow">
                WELCOME BACK
              </p>


              <h2>
                Sign in to your account
              </h2>


              <p className="subtitle">
                Enter your credentials to continue.
              </p>

            </div>

          </div>


          <form
            onSubmit={handleLogin}
          >


            {/* USERNAME */}

            <div className="input-group">

              <label htmlFor="username">
                Username
              </label>


              <div className="input-wrapper">

                <User
                  size={17}
                  strokeWidth={2}
                />


                <input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>


            {/* PASSWORD */}

            <div className="input-group">

              <div className="label-row">

                <label htmlFor="password">
                  Password
                </label>


                <button
                  type="button"
                  className="forgot-button"
                >
                  Forgot password?
                </button>

              </div>


              <div className="input-wrapper">

                <Lock
                  size={17}
                  strokeWidth={2}
                />


                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                />


                <button
                  type="button"
                  className="show-button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                >

                  {
                    showPassword
                      ? <EyeOff size={17} />
                      : <Eye size={17} />
                  }

                </button>

              </div>

            </div>


            {/* REMEMBER ME */}

            <div className="remember-row">

              <label>

                <input
                  type="checkbox"
                />

                <span>
                  Remember me
                </span>

              </label>

            </div>


            {/* LOGIN */}

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >

              <span>
                {
                  loading
                    ? "Signing in..."
                    : "Sign in"
                }
              </span>

              <span className="arrow">
                →
              </span>

            </button>

          </form>


          {error && (

            <p className="login-error">
              {error}
            </p>

          )}


          <div className="security-note">

            <span>
              ⌾
            </span>

            <p>
              Your information is protected with
              secure authentication.
            </p>

          </div>

        </div>

      </section>

    </main>
  );
}


// ============================================================
// APP ROUTER
// ============================================================

function App() {

  return (
    <>
      <ToastHost />
      <Routes>

        {/* DEFAULT */}

        <Route
          path="/"
          element={
            <LoginPage />
          }
        />


        {/* LOGIN */}

        <Route
          path="/login"
          element={
            <LoginPage />
          }
        />


        {/* DASHBOARD */}

        <Route
          path="/dashboard"
          element={
            <Dashboard />
          }
        />


        {/* CUSTOMERS */}

        <Route
          path="/customers"
          element={
            <Customers />
          }
        />


        {/* ACCOUNTS */}

        <Route
          path="/accounts"
          element={
            <Accounts />
          }
        />

        {/* TRANSACTIONS */}

        <Route
          path="/transactions"
          element={
            <Transactions />
          }
        />

      </Routes>
    </>
  );
}


export default App;
