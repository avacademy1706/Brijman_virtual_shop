# Privacy in the virtual try-on

Plain-language summary for shoppers and staff. The same points appear in the try-on under "How your privacy is protected".

- **It all happens on your device.** The face tracking runs inside your browser. The picture from your camera is never uploaded, recorded or stored.
- **We never ask for the camera until you choose it.** The first time, a screen explains this and offers **Allow camera** or **Use a photo instead**. We remember only which you chose, on your device.
- **Your face stays private.** The shape of your face and the measurements used to size the frame are kept in memory while the try-on is open, and are deleted when you close it. They are never sent to us, to analytics or to anyone else, and never saved.
- **Photos stay with you.** Photos you take stay in this browser tab. They are deleted when you close the try-on, unless you save them to your own device.
- **Uploaded photos are processed on your device too.** They are not uploaded.
- **What we do count.** Only which frames, colours and sizes are tried, whether a photo was taken, whether something was added to the bag, and whether the fit read "good", "narrow" or "wide". Never a measurement or an image.
- **The camera switches off** when you close the try-on, switch tabs or leave the page. It turns back on only when you ask.
- **The fit guide is an estimate.** It compares the frame width with your face width, measured against the average size of the iris. It is not a measurement for prescriptions.

Technical notes for the team: see `docs/try-on.md`. The page's security headers allow the camera for this site only (`camera=(self)`) and WebAssembly (`'wasm-unsafe-eval'`); nothing in the try-on connects to another origin.
