# PhysicsEdu

An interactive physics simulation app covering elementary school through graduate-level concepts. 35 real-time simulations across 7 domains, all running in the browser with Canvas rendering.

**[Try it live](https://physicsplayground-7ruga1bp8-mhrthu-5111s-projects.vercel.app)**

---

## Simulations

### Mechanics (9)
| Simulation | Level | Description |
|---|---|---|
| Projectile Motion | Intro | Launch a ball and explore parabolic trajectories |
| Simple Pendulum | Inter | Oscillation with adjustable length and gravity |
| Inclined Plane | Inter | Forces, friction, and acceleration on a slope |
| Spring-Mass Oscillator | Standard | Hooke's law with damping and energy graphs |
| Rigid Body Collisions | Standard | Elastic and inelastic collisions with momentum vectors |
| Orbital Mechanics | Advanced | Two-body gravitation with Verlet integration |
| Double Pendulum | Advanced | Chaotic motion with RK4 integration and trail |
| Lagrangian Mechanics | Theory | Generalized coordinates and equations of motion |
| Energy Skate Park | Inter | Conservation of energy with KE/PE/thermal bar chart |

### Thermodynamics (4)
| Simulation | Level | Description |
|---|---|---|
| Ideal Gas Law | Inter | PV=nRT with draggable piston and particle simulation |
| Heat Conduction | Standard | 2D diffusion with hot/cold sources and colormapped grid |
| Carnot Cycle | Advanced | PV diagram with isothermal and adiabatic processes |
| Statistical Mechanics | Theory | Boltzmann distribution, microcanonical/canonical ensembles |

### Electromagnetism (5)
| Simulation | Level | Description |
|---|---|---|
| Coulomb's Law | Inter | Interactive charges with force vectors |
| Electric Field Lines | Standard | Field line visualization from point charges |
| Electromagnetic Wave | Advanced | E and B field propagation with polarization modes |
| Electromagnetic Induction | Standard | Drag a magnet through a coil, observe induced EMF |
| Magnetic Field of Current | Advanced | Biot-Savart law field visualization |

### Quantum & Nuclear (5)
| Simulation | Level | Description |
|---|---|---|
| Wave-Particle Duality | Standard | Double-slit experiment with detection patterns |
| Schrodinger 1D | Advanced | Quantum well wavefunctions and energy levels |
| Hydrogen Orbitals | Advanced | Probability density visualization for n,l,m states |
| Radioactive Decay | Standard | Stochastic decay with N(t) curve vs theory |
| Nuclear Chain Reaction | Standard | Fission neutron cascade with k-factor tracking |

### Astrophysics (4)
| Simulation | Level | Description |
|---|---|---|
| N-Body Gravity | Advanced | Multi-body gravitational simulation |
| Gravitational Lensing | Advanced | Light bending around massive objects |
| Stellar Evolution | Advanced | HR diagram tracks for different stellar masses |
| Expanding Universe | Theory | Friedmann equation with dark energy |

### Optics (4)
| Simulation | Level | Description |
|---|---|---|
| Ray Optics | Standard | Lenses, mirrors, and prisms with ray tracing |
| Ripple Tank | Standard | 2D wave interference with draggable sources |
| Snell's Law / Refraction | Inter | Refraction with adjustable media and total internal reflection |
| Standing Waves | Standard | String harmonics with nodes and antinodes |

### Fluid & Aero (4)
| Simulation | Level | Description |
|---|---|---|
| Navier-Stokes Fluid | Advanced | Stable Fluids algorithm with interactive dye injection |
| Bernoulli Pipe Flow | Standard | Venturi effect with pressure manometers |
| Airfoil & Lift | Advanced | NACA airfoil with streamlines and lift/drag forces |
| Karman Vortex Street | Advanced | Vortex shedding behind a cylinder |

---

## Tech Stack

- **React 19** + **TypeScript** — UI framework
- **Vite** — Build tool with HMR
- **Tailwind CSS v4** — Styling
- **HTML5 Canvas** — All simulation rendering at 60fps
- **Custom physics engine** — `SimulationEngine` abstract base class with declarative controls

## Architecture

```
src/
  engine/          # SimulationEngine base class, Vector2, numerical integrators, draw utilities
  simulations/     # 35 sims, each with *Sim.ts + meta.ts + index.ts
  catalog/         # Self-registration registry, domain/level enums
  controls/        # Declarative control panel (sliders, toggles, dropdowns, buttons)
  hooks/           # useSimulation, useAnimationLoop
  layout/          # AppLayout, Sidebar (accordion), SimulationView
```

Each simulation extends `SimulationEngine` and implements:
- `setup()` — Initialize state
- `update(dt)` — Physics step
- `render()` — Canvas drawing
- `getControlDescriptors()` — Declare UI controls
- Optional: `onPointerDown/Move/Up()` — Mouse interaction

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Building

```bash
npm run build
```

Output goes to `dist/`.

## License

MIT
