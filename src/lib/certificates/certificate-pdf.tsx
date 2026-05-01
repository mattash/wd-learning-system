import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";

// Register fonts (use Helvetica built-ins for reliability)
Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: 700 },
    { src: "Helvetica-Oblique", fontStyle: "italic" },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 12,
    color: "#1a1a2e",
  },
  header: {
    marginBottom: 32,
    borderBottom: "2pt solid #6B2D8B",
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica",
    fontWeight: 700,
    color: "#6B2D8B",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  body: {
    marginTop: 24,
  },
  awardLine: {
    fontSize: 28,
    fontFamily: "Helvetica",
    fontWeight: 700,
    color: "#1a1a2e",
    textAlign: "center",
    marginBottom: 4,
  },
  awardSub: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    marginBottom: 36,
  },
  certText: {
    fontSize: 11,
    color: "#333",
    lineHeight: 1.8,
    marginBottom: 6,
  },
  certLabel: {
    fontSize: 9,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  certValue: {
    fontSize: 13,
    color: "#1a1a2e",
    marginBottom: 16,
  },
  certValueLarge: {
    fontSize: 18,
    fontFamily: "Helvetica",
    fontWeight: 700,
    color: "#1a1a2e",
    marginBottom: 20,
  },
  divider: {
    borderBottom: "0.5pt solid #ddd",
    marginVertical: 24,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 48,
    right: 48,
    borderTop: "0.5pt solid #ddd",
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#aaa",
  },
  seal: {
    position: "absolute",
    right: 48,
    bottom: 100,
    width: 64,
    height: 64,
    borderRadius: 32,
    border: "2pt solid #6B2D8B",
    alignItems: "center",
    justifyContent: "center",
  },
  sealText: {
    fontSize: 8,
    color: "#6B2D8B",
    textAlign: "center",
    fontFamily: "Helvetica",
    fontWeight: 700,
  },
});

export interface CertificateData {
  studentName: string;
  courseTitle: string;
  parishName: string;
  completionDate: string; // formatted date string
  courseLessonCount: number;
}

type CertificateDocumentProps = DocumentProps & { data: CertificateData };

export function CertificateDocument({ data }: CertificateDocumentProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <Text style={styles.subtitle}>Western Diocese of the Armenian Church</Text>
          <Text style={styles.title}>Certificate of Completion</Text>
        </View>

        {/* Award body */}
        <View style={styles.body}>
          <Text style={styles.awardLine}>This certifies that</Text>
          <Text style={styles.awardSub}>{data.studentName}</Text>

          <Text style={styles.certText}>
            has successfully completed all lessons in the course
          </Text>
          <Text style={styles.certValueLarge}>{data.courseTitle}</Text>

          <View style={styles.divider} />

          <Text style={styles.certLabel}>Parish</Text>
          <Text style={styles.certValue}>{data.parishName}</Text>

          <Text style={styles.certLabel}>Completion Date</Text>
          <Text style={styles.certValue}>{data.completionDate}</Text>

          <Text style={styles.certLabel}>Total Lessons Completed</Text>
          <Text style={styles.certValue}>{data.courseLessonCount}</Text>
        </View>

        {/* Decorative seal */}
        <View style={styles.seal}>
          <Text style={styles.sealText}>WD{'\n'}CERTIFIED</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            St. John Armenian Apostolic Church Learning System
          </Text>
          <Text style={styles.footerText}>
            Issued: {data.completionDate}
          </Text>
        </View>
      </Page>
    </Document>
  );
}