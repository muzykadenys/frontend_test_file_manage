import "@/styles/globals.css";
import App, { AppInitialProps } from "next/app";
import { StoreProvider } from "@/store";

type AppProps = AppInitialProps & { Component: App["props"]["Component"] };

export default class MyApp extends App<AppProps> {
  render() {
    const { Component, pageProps } = this.props;
    return (
      <StoreProvider>
        <Component {...pageProps} />
      </StoreProvider>
    );
  }
}
