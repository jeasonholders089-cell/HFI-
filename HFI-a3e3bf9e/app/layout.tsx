import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const geistSans=Geist({variable:"--font-geist-sans",subsets:["latin"]});
const geistMono=Geist_Mono({variable:"--font-geist-mono",subsets:["latin"]});
export const metadata:Metadata={title:"HFI 家长成长营",description:"看见每个孩子的可能性"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh" className={`${geistSans.variable} ${geistMono.variable}`}><body>{children}</body></html>}
