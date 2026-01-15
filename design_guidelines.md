# Wisdom & Chance TCG - Design Guidelines

## Design Approach
**Theme:** Dark fantasy card game with mystical purple/slate tones
**Primary Colors:** Purple gradients with slate backgrounds
**Style:** Immersive gaming experience with glass-morphism effects

---

## Color Palette

### Base Theme (Dark Mode Primary)
- **Background**: Slate 900 with purple gradients (`from-slate-900 via-purple-900/30 to-slate-900`)
- **Cards/Surfaces**: Slate 800 with transparency (`bg-slate-800/50`)
- **Borders**: Purple with low opacity (`border-purple-500/20`)
- **Text Primary**: White (`text-white`)
- **Text Secondary**: Purple 200-300 (`text-purple-200`, `text-purple-300`)
- **Text Muted**: Purple 400 (`text-purple-400`)

### Element Colors
| Element | Primary Gradient | Text Color | Background |
|---------|-----------------|------------|------------|
| Fire | `from-red-600 to-orange-600` | `text-red-500` | `bg-red-600` |
| Water | `from-blue-600 to-cyan-600` | `text-blue-500` | `bg-blue-600` |
| Earth | `from-amber-700 to-yellow-600` | `text-amber-500` | `bg-amber-600` |
| Air | `from-green-400 to-teal-400` | `text-green-400` | `bg-green-500` |
| Nature | `from-green-700 to-emerald-600` | `text-emerald-500` | `bg-emerald-600` |

### Action Colors
- **Primary Action**: `from-purple-600 to-pink-600`
- **Secondary Action**: `from-cyan-600 to-blue-600`
- **Combat/Danger**: `from-red-600 to-orange-600`
- **Success**: `bg-green-600`
- **Warning**: `text-amber-400`

---

## Typography

**Type Scale:**
- Page titles: `text-4xl md:text-5xl font-bold text-white`
- Section headers: `text-xl md:text-2xl font-bold text-white`
- Body: `text-base text-purple-200`
- Labels: `text-sm text-purple-300`

---

## Layout

**Spacing:**
- Page padding: `p-4 md:p-6`
- Card padding: `p-4` to `p-8`
- Gaps: `gap-4`, `gap-6`

**Container:**
- Max width: `max-w-7xl mx-auto`
- Full page: `min-h-full`

---

## Components

### Cards (UI)
```jsx
<Card className="bg-slate-800/50 border-purple-500/20">
```

### Game Cards (TCG)
- Aspect ratio: `aspect-[3/4]`
- Element gradient background
- Power number top-left
- Element icon centered
- Rounded: `rounded-lg`
- Border matches element color

### Buttons
Primary with gradient and shadow:
```jsx
<Button className="bg-gradient-to-r from-purple-600 to-pink-600 shadow-xl shadow-purple-500/30">
```

---

## Icons

**Library:** Lucide React

**Element Icons:**
- Fire: `Flame`
- Water: `Droplet`
- Earth: `Mountain`
- Air: `Wind`
- Nature: `Leaf`

**Game Icons:**
- Combat: `Swords`
- Defense: `Shield`
- Victory: `Trophy`
- Commander: `Crown`
- Health: `Heart`

---

## Responsive

- Mobile first
- Grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6`
- Text scaling: `text-base md:text-lg`
- Hidden elements: `hidden md:block`
