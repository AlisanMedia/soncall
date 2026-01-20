
import React from 'react';
import { Page, Text, View, Document, StyleSheet, renderToBuffer, Font } from '@react-pdf/renderer';

// Register a standard font (optional, using standard Helvetica by default)
// Font.register({ family: 'Roboto', src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf' });

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        padding: 30,
        fontFamily: 'Helvetica'
    },
    header: {
        marginBottom: 20,
        borderBottom: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#6D28D9'
    },
    date: {
        fontSize: 12,
        color: '#666'
    },
    section: {
        margin: 10,
        padding: 10,
        flexGrow: 1
    },
    sectionTitle: {
        fontSize: 16,
        marginBottom: 10,
        fontWeight: 'bold',
        color: '#333'
    },
    summaryGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20
    },
    card: {
        backgroundColor: '#f9f9f9',
        padding: 15,
        borderRadius: 5,
        width: '30%',
        alignItems: 'center'
    },
    cardValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#6D28D9',
        marginBottom: 5
    },
    cardLabel: {
        fontSize: 10,
        color: '#666',
        textTransform: 'uppercase'
    },
    table: {
        display: 'flex',
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderColor: '#eee'
    },
    tableRow: { margin: 'auto', flexDirection: 'row' },
    tableCol: {
        width: '25%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderColor: '#eee'
    },
    tableHeader: {
        backgroundColor: '#f3f4f6',
        fontWeight: 'bold'
    },
    tableCell: {
        margin: 5,
        fontSize: 10
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        textAlign: 'center',
        color: '#999',
        fontSize: 10,
        borderTop: 1,
        borderTopColor: '#eee',
        paddingTop: 10
    }
});

interface ReportData {
    summary: {
        totalLeadsTotal: number;
        conversionRate: number;
        appointments: number;
        topStatus: string;
    };
    agentPerformance: Array<{
        name: string;
        totalProcessed: number;
        appointments: number;
        score: number;
    }>;
    date: string;
}

const ReportDocument = ({ data }: { data: ReportData }) => (
    <Document>
        <Page size="A4" style={styles.page}>

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>ArtificAgent</Text>
                    <Text style={{ fontSize: 10, color: '#999' }}>Performance Report</Text>
                </View>
                <Text style={styles.date}>{data.date}</Text>
            </View>

            {/* Summary Cards */}
            <View style={styles.summaryGrid}>
                <View style={styles.card}>
                    <Text style={styles.cardValue}>{data.summary.totalLeadsTotal}</Text>
                    <Text style={styles.cardLabel}>TOTAL LEADS</Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.cardValue}>%{data.summary.conversionRate}</Text>
                    <Text style={styles.cardLabel}>CONVERSION RATE</Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.cardValue}>{data.summary.appointments}</Text>
                    <Text style={styles.cardLabel}>APPOINTMENTS</Text>
                </View>
            </View>

            {/* Agent Performance Table */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Agent Performance</Text>

                <View style={styles.table}>
                    {/* Header Row */}
                    <View style={[styles.tableRow, styles.tableHeader]}>
                        <View style={styles.tableCol}><Text style={styles.tableCell}>Agent Name</Text></View>
                        <View style={styles.tableCol}><Text style={styles.tableCell}>Processed Leads</Text></View>
                        <View style={styles.tableCol}><Text style={styles.tableCell}>Appointments</Text></View>
                        <View style={styles.tableCol}><Text style={styles.tableCell}>Score</Text></View>
                    </View>

                    {/* Data Rows */}
                    {data.agentPerformance.map((agent, i) => (
                        <View key={i} style={styles.tableRow}>
                            <View style={styles.tableCol}><Text style={styles.tableCell}>{agent.name}</Text></View>
                            <View style={styles.tableCol}><Text style={styles.tableCell}>{agent.totalProcessed}</Text></View>
                            <View style={styles.tableCol}><Text style={styles.tableCell}>{agent.appointments}</Text></View>
                            <View style={styles.tableCol}><Text style={styles.tableCell}>{agent.score}</Text></View>
                        </View>
                    ))}
                </View>
            </View>

            {/* Footer */}
            <Text style={styles.footer}>
                Generated automatically by ArtificAgent • {data.date}
            </Text>
        </Page>
    </Document>
);

export async function generatePDF(data: any): Promise<Buffer> {
    const reportData: ReportData = {
        summary: data.summary,
        agentPerformance: data.agentPerformance,
        date: new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    };

    // Note: renderToBuffer ensures Node.js compatibility
    return await renderToBuffer(<ReportDocument data={reportData} />);
}
