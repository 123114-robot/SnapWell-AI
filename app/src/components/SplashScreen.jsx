import './SplashScreen.css'

export default function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-overlay" />

      <div className="splash-content">
        <div className="splash-logo">
          SnapWell
        </div>

        <div className="splash-subtitle">
          AI Recipe Assistant
        </div>

        <div className="splash-loader" />
      </div>
    </div>
  )
}