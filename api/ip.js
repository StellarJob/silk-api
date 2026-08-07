export default async function handler(req, res) {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    res.status(200).json({
      outbound_ip: data.ip,
      message: "This is the IP Vercel uses for outbound connections."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
