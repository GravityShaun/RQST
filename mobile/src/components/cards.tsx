import { Text, View } from "react-native";

type HeroCardProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
};

export function HeroCard({ eyebrow, title, subtitle, cta }: HeroCardProps) {
  return (
    <View style={{ backgroundColor: "#231A29", borderRadius: 28, padding: 20, gap: 10 }}>
      <Text style={{ color: "#5EF2FF", fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>{eyebrow}</Text>
      <Text style={{ color: "#F8F1FF", fontSize: 30, fontWeight: "800" }}>{title}</Text>
      <Text style={{ color: "#BDAFCA", fontSize: 16 }}>{subtitle}</Text>
      <Text style={{ color: "#FF5D5D", fontSize: 16, fontWeight: "700" }}>{cta}</Text>
    </View>
  );
}

export function SectionCard({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={{ backgroundColor: "#16111A", borderRadius: 24, padding: 18, gap: 12 }}>
      <Text style={{ color: "#F8F1FF", fontSize: 20, fontWeight: "700" }}>{title}</Text>
      {items.map((item) => (
        <Text key={item} style={{ color: "#BDAFCA", fontSize: 15 }}>
          {item}
        </Text>
      ))}
    </View>
  );
}

export function VenueMarkerCard({
  title,
  subtitle,
  amount,
}: {
  title: string;
  subtitle: string;
  amount: string;
}) {
  return (
    <View style={{ backgroundColor: "#16111A", borderRadius: 24, padding: 18, gap: 6 }}>
      <Text style={{ color: "#F8F1FF", fontSize: 22, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: "#BDAFCA" }}>{subtitle}</Text>
      <Text style={{ color: "#FF5D5D", fontWeight: "700" }}>{amount}</Text>
    </View>
  );
}

export function QueueRow({
  rank,
  title,
  artist,
  total,
  contributors,
  status,
}: {
  rank: number;
  title: string;
  artist: string;
  total: number;
  contributors: number;
  status: string;
}) {
  return (
    <View style={{ backgroundColor: "#16111A", borderRadius: 24, padding: 18, gap: 8 }}>
      <Text style={{ color: "#5EF2FF", fontWeight: "700" }}>#{rank}</Text>
      <Text style={{ color: "#F8F1FF", fontSize: 20, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: "#BDAFCA" }}>{artist}</Text>
      <Text style={{ color: "#FF5D5D", fontWeight: "700" }}>${(total / 100).toFixed(2)}</Text>
      <Text style={{ color: "#BDAFCA" }}>{contributors} contributors · {status}</Text>
    </View>
  );
}

