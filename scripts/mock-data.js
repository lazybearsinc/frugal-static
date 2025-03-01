const mockData = {
    warehouses: [
        {
            warehouse_id: "123",
            city: "Toronto",
            state: "ON",
            country: "CA",
            address: "50 Queen Street",
            zip_code: "L1Z1E5",
            slug: "toronto-on-123",
            deals: [
                {
                    id: "1234567",
                    title: "Samsung 65\" 4K Smart TV",
                    slug: "1234567-samsung-65-4k-smart-tv",
                    savings: "$300.00",
                    imageUrl: "/images/placeholder.svg",
                    itemNumber: "1234567",
                    startDate: new Date("2024-03-01"),
                    endDate: new Date("2024-04-01"),
                    daysLeft: 15,
                    description: "Samsung 65\" Class Crystal UHD 4K Smart TV",
                    isOnlineOnly: false
                },
                {
                    id: "7654321",
                    title: "KitchenAid Stand Mixer",
                    slug: "7654321-kitchenaid-stand-mixer",
                    savings: "$150.00",
                    imageUrl: "/images/placeholder.svg",
                    itemNumber: "7654321",
                    startDate: new Date("2024-03-01"),
                    endDate: new Date("2024-04-01"),
                    daysLeft: 20,
                    description: "KitchenAid Professional 5 Plus Series Stand Mixer",
                    isOnlineOnly: false
                }
            ]
        }
    ]
};

module.exports = mockData; 