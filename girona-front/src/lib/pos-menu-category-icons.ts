import type { IconType } from "react-icons";
import { BiSolidDrink, BiSolidDish } from "react-icons/bi";
import { FaBitbucket, FaWineBottle } from "react-icons/fa";
import {
  FaBowlFood,
  FaChild,
  FaGlassWater,
  FaHotdog,
  FaIceCream,
  FaStroopwafel,
} from "react-icons/fa6";
import {
  GiBeerBottle,
  GiCutLemon,
  GiJug,
  GiMeat,
  GiMilkCarton,
  GiSodaCan,
} from "react-icons/gi";
import { LiaWineGlassAltSolid } from "react-icons/lia";
import { LuCupSoda, LuEggFried } from "react-icons/lu";
import { MdOutlineFoodBank } from "react-icons/md";
import {
  PiBeerBottleBold,
  PiBowlFoodFill,
  PiHamburgerBold,
  PiLeaf,
} from "react-icons/pi";
import {
  RiDrinks2Fill,
  RiRestaurantLine,
} from "react-icons/ri";

export function posCategoryKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const RESTAURANTE_CATEGORY_ICONS = [
  { label: "Almuerzos", Icon: FaBowlFood },
  { label: "Antojitos de la casa", Icon: MdOutlineFoodBank },
  { label: "Burguers", Icon: PiHamburgerBold },
  { label: "Desayunos", Icon: LuEggFried },
  { label: "Dogs", Icon: FaHotdog },
  { label: "Entradas", Icon: RiRestaurantLine },
  { label: "Ensaladas", Icon: PiLeaf },
  { label: "Menu infantil", Icon: FaChild },
  { label: "para Tardear", Icon: FaStroopwafel },
  { label: "Platos fuertes", Icon: GiMeat },
  { label: "Platos especiales", Icon: BiSolidDish },
  { label: "Postres", Icon: FaIceCream },
] as const;

/** Incluye categorías por defecto del bar; «Licores y shots» coincide con «Licores y Shots». */
export const BAR_CATEGORY_ICONS = [
  { label: "Bebidas", Icon: RiDrinks2Fill },
  { label: "Malteadas", Icon: GiMilkCarton },
  { label: "Dulces bar", Icon: FaIceCream },
  { label: "Cervezas nacionales", Icon: PiBeerBottleBold },
  { label: "Cervezas Internacionales", Icon: GiBeerBottle },
  { label: "Cocteleria", Icon: LiaWineGlassAltSolid },
  { label: "Cubetazos", Icon: FaBitbucket },
  { label: "Gaseosas", Icon: LuCupSoda },
  { label: "Licores y shots", Icon: BiSolidDrink },
  { label: "Micheladas", Icon: GiCutLemon },
  { label: "Para el almuerzo", Icon: GiJug },
  { label: "Sodas", Icon: GiSodaCan },
  { label: "Vinos", Icon: FaWineBottle },
] as const;

export function getPosCategoryIcon(label: string, scope: "rest" | "bar"): IconType {
  const nav = scope === "bar" ? BAR_CATEGORY_ICONS : RESTAURANTE_CATEGORY_ICONS;
  const k = posCategoryKey(label);
  const found = nav.find((n) => posCategoryKey(n.label) === k);
  return found ? found.Icon : scope === "bar" ? FaGlassWater : PiBowlFoodFill;
}
