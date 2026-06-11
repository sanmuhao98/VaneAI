import type { Metadata } from 'next'
import { Geist, Geist_Mono, Noto_Sans_SC, Noto_Serif_SC } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const notoSansSC = Noto_Sans_SC({
  variable: '--font-noto-sans-sc',
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
})

const notoSerifSC = Noto_Serif_SC({
  variable: '--font-noto-serif-sc',
  weight: ['700', '900'],
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'VaneAI · 一键复刻爆款',
    template: '%s · VaneAI',
  },
  description: '从模板出发，少改 prompt，先要结果。',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansSC.variable} ${notoSerifSC.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
