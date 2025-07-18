import React, { useState, useEffect } from "react";
import {
    SafeAreaView, ScrollView, View, Text, TextInput,
    Image, StyleSheet, TouchableOpacity, Modal, ActivityIndicator
} from "react-native";
import TopHeader from "../components/TopHeader";
import BottomFooter from "../components/BottomFooter";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../Navigation/types";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import { useLandmark } from "../provider/LandmarkProvider";

type Marker = {
    name: string;
    image: string;
    category: string;
    latitude: number;
    longitude: number;
    openingHours?: Record<string, { open: string; close: string; closed: boolean }>;
};

const getOpenStatus = (openingHours?: Marker["openingHours"]) => {
    if (!openingHours) return "Opening hours unavailable";

    const now = new Date();
    const dayName = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const today = openingHours[dayName];

    if (!today || today.closed) return "Closed today";

    const [openHour, openMinute] = today.open.split(":").map(Number);
    const [closeHour, closeMinute] = today.close.split(":").map(Number);

    const openTime = new Date();
    openTime.setHours(openHour, openMinute, 0, 0);

    const closeTime = new Date();
    closeTime.setHours(closeHour, closeMinute, 0, 0);

    if (now >= openTime && now <= closeTime) {
        return `Open now until ${today.close}`;
    } else {
        return "Closed now";
    }
};

const SearchScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [searchText, setSearchText] = useState("");
    const [modalVisible, setModalVisible] = useState(false);
    const [modalImage, setModalImage] = useState("");
    const [allMarkers, setAllMarkers] = useState<Marker[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);

    const { setSelectedLandmark, loadDirection } = useLandmark();

    const handleImageTap = (marker: Marker) => {
        setSelectedMarker(marker);
        setModalImage(marker.image);
        setModalVisible(true);
    };

    useEffect(() => {
        const fetchMarkers = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, "markers"));
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => {
                    const d = doc.data();
                    return {
                        name: d.name,
                        image: d.image?.trim() || "https://via.placeholder.com/150",
                        category: d.categoryOption || d.category || "Others",
                        latitude: d.latitude,
                        longitude: d.longitude,
                        openingHours: d.openingHours || {},
                    };
                });
                setAllMarkers(data);
            } catch (err) {
                console.error("Error fetching markers:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMarkers();
    }, []);

    const filteredMarkers = allMarkers.filter(marker =>
        marker.name.toLowerCase().includes(searchText.toLowerCase()) ||
        marker.category.toLowerCase().includes(searchText.toLowerCase())
    );

    const groupedByCategory = (category: string) =>
        allMarkers.filter(m => m.category.toLowerCase() === category.toLowerCase());

    const renderSection = (title: string, items: Marker[]) => {
        if (items.length === 0) return null;
        return (
            <>
                <Text style={styles.sectionTitle}>{title}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                    {items.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.cardLarge}
                            onPress={() => handleImageTap(item)}
                        >
                            <Image source={{ uri: item.image }} style={styles.cardImageLarge} />
                            <Text style={styles.cardLabel}>{item.name}</Text>
                            <Text style={styles.statusLabel}>{getOpenStatus(item.openingHours)}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <TopHeader title="Search" onSupportPress={() => navigation.navigate("Support")} />
            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.searchWrapper}>
                    <Text style={styles.searchLabel}>Search any keyword...</Text>
                    <View style={styles.searchInputContainer}>
                        <TextInput
                            style={styles.searchInput}
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="Type here..."
                            placeholderTextColor="#999"
                        />
                        <Image
                            source={{ uri: "https://cdn-icons-png.flaticon.com/512/622/622669.png" }}
                            style={styles.searchIcon}
                        />
                    </View>
                </View>

                {loading && <ActivityIndicator size="large" color="#493628" style={{ marginTop: 20 }} />}

                {searchText.trim() !== "" ? (
                    filteredMarkers.length > 0 ? (
                        renderSection("Search Results", filteredMarkers)
                    ) : (
                        <Text style={styles.noResult}>No results found.</Text>
                    )
                ) : (
                    <>
                        {renderSection("Historical", groupedByCategory("Historical"))}
                        {renderSection("Museum", groupedByCategory("Museum"))}
                        {renderSection("Park", groupedByCategory("Park"))}
                        {renderSection("Restaurant", groupedByCategory("Restaurant"))}
                        {renderSection("School", groupedByCategory("School"))}
                        {renderSection("Others", groupedByCategory("Others"))}
                    </>
                )}
            </ScrollView>

            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Image source={{ uri: modalImage }} style={styles.modalImage} resizeMode="contain" />
                        {selectedMarker && (
                            <>
                                <Text style={{ color: "#fff", fontSize: 18, marginVertical: 10, textAlign: "center" }}>
                                    {selectedMarker.name}
                                </Text>
                                <Text style={{ color: "#ccc", fontSize: 14, textAlign: "center" }}>
                                    {getOpenStatus(selectedMarker.openingHours)}
                                </Text>
                                <TouchableOpacity
                                    style={styles.navigateButton}
                                    onPress={() => {
                                        setModalVisible(false);
                                        setSelectedLandmark(selectedMarker);
                                        loadDirection(); // optional preload
                                        navigation.navigate("Map", {
                                            latitude: selectedMarker.latitude,
                                            longitude: selectedMarker.longitude,
                                            name: selectedMarker.name,
                                        });
                                    }}
                                >
                                    <Text style={styles.navigateButtonText}>Navigate</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            <BottomFooter active="Search" />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#FFFFFF" },
    scrollContainer: { flex: 1 },
    searchWrapper: { paddingHorizontal: 22, paddingTop: 20 },
    searchLabel: { color: "#6B5E5E", fontSize: 13, marginBottom: 8 },
    searchInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        position: "relative",
    },
    searchInput: {
        flex: 1,
        height: 47,
        borderRadius: 15,
        borderColor: "#493628",
        borderWidth: 1,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingRight: 50,
        fontSize: 16,
    },
    searchIcon: {
        position: "absolute",
        right: 12,
        width: 24,
        height: 24,
        tintColor: "#493628",
    },
    sectionTitle: {
        color: "#493628",
        fontSize: 24,
        fontWeight: "bold",
        marginTop: 24,
        marginLeft: 22,
        marginBottom: 12,
    },
    horizontalScroll: {
        paddingLeft: 22,
        marginBottom: 24,
    },
    cardLarge: { width: 209, marginRight: 16 },
    cardImageLarge: {
        width: "100%",
        height: 160,
        borderRadius: 12,
        backgroundColor: "#D9D9D9",
    },
    cardLabel: {
        marginTop: 6,
        fontSize: 14,
        color: "#493628",
        fontWeight: "500",
        textAlign: "center",
    },
    statusLabel: {
        fontSize: 12,
        textAlign: "center",
        color: "#888",
        marginTop: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContainer: {
        width: "90%",
        height: "70%",
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "#222",
        padding: 12,
    },
    modalImage: {
        width: "100%",
        height: "70%",
        borderRadius: 8,
        marginBottom: 8,
    },
    noResult: {
        textAlign: "center",
        fontSize: 16,
        color: "#999",
        marginTop: 20,
    },
    navigateButton: {
        marginTop: 12,
        paddingVertical: 10,
        backgroundColor: "#493628",
        borderRadius: 8,
        alignItems: "center",
    },
    navigateButtonText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "600",
    },
});

export default SearchScreen;
